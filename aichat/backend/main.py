from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import json
import time
import os
from datetime import datetime
import openai
from openai import OpenAI
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, status
import fitz  # PyMuPDF

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(title="AI Chatbot API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY", "0p")
)

# In-memory storage
class ChatStats:
    def __init__(self):
        self.total_chats = 0
        self.total_tokens = 0
        self.conversations = []
        self.response_times = []
        self.model_config = {
            "temperature": 0.7,
            "max_tokens": 1000,
            "model": "gpt-3.5-turbo"
        }
        self.active_connections = []

stats = ChatStats()

# --- Database setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./chatbot_users.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- User model ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

Base.metadata.create_all(bind=engine)

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# --- JWT config ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

def create_access_token(data: dict):
    import datetime
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_exception
    return user

# --- Registration endpoint ---
class UserCreate(BaseModel):
    email: str
    password: str

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

# --- Login endpoint (token) ---
@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class ConfigRequest(BaseModel):
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    model: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Send current stats when requested
            if data == "get_stats":
                stats_data = {
                    "total_chats": stats.total_chats,
                    "total_tokens": stats.total_tokens,
                    "average_response_time": sum(stats.response_times) / len(stats.response_times) if stats.response_times else 0,
                    "recent_conversations": stats.conversations[-5:] if stats.conversations else [],
                    "model_config": stats.model_config
                }
                await websocket.send_text(json.dumps(stats_data))
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        start_time = time.time()
        
        # Update model config if provided
        temperature = request.temperature if request.temperature is not None else stats.model_config["temperature"]
        max_tokens = request.max_tokens if request.max_tokens is not None else stats.model_config["max_tokens"]
        
        # Create chat completion
        response = client.chat.completions.create(
            model=stats.model_config["model"],
            messages=[
                {"role": "user", "content": request.message}
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )
        
        async def generate():
            full_response = ""
            total_tokens = 0
            
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    total_tokens += 1
                    
                    # Send chunk to frontend
                    yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
                    
                    # Small delay to simulate realistic streaming
                    await asyncio.sleep(0.02)
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Update stats
            stats.total_chats += 1
            stats.total_tokens += total_tokens
            stats.response_times.append(response_time)
            stats.conversations.append({
                "user_message": request.message,
                "assistant_response": full_response,
                "timestamp": datetime.now().isoformat(),
                "response_time": response_time,
                "tokens": total_tokens
            })
            
            # Keep only last 50 conversations
            if len(stats.conversations) > 50:
                stats.conversations = stats.conversations[-50:]
            
            # Keep only last 100 response times
            if len(stats.response_times) > 100:
                stats.response_times = stats.response_times[-100:]
            
            # Broadcast updated stats
            stats_data = {
                "total_chats": stats.total_chats,
                "total_tokens": stats.total_tokens,
                "average_response_time": sum(stats.response_times) / len(stats.response_times) if stats.response_times else 0,
                "recent_conversations": stats.conversations[-5:] if stats.conversations else [],
                "model_config": stats.model_config
            }
            await manager.broadcast(json.dumps(stats_data))
            
            # Send completion signal
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        # Read PDF file into memory
        contents = await file.read()
        with open("temp_upload.pdf", "wb") as f:
            f.write(contents)
        # Extract text from PDF
        doc = fitz.open("temp_upload.pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        # Remove temp file
        import os
        os.remove("temp_upload.pdf")
        # Truncate text if too long for OpenAI
        max_len = 4000
        if len(text) > max_len:
            text = text[:max_len] + "..."
        # Summarize with OpenAI
        response = client.chat.completions.create(
            model=stats.model_config["model"],
            messages=[
                {"role": "system", "content": "Summarize the following PDF content:"},
                {"role": "user", "content": text}
            ],
            temperature=0.5,
            max_tokens=300
        )
        summary = ""
        for chunk in response:
            if chunk.choices[0].delta.content is not None:
                summary += chunk.choices[0].delta.content
        return {"summary": summary}
    except Exception as e:
        logger.error(f"PDF upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process PDF.")

@app.get("/stats")
async def get_stats():
    return {
        "total_chats": stats.total_chats,
        "total_tokens": stats.total_tokens,
        "average_response_time": sum(stats.response_times) / len(stats.response_times) if stats.response_times else 0,
        "recent_conversations": stats.conversations[-5:] if stats.conversations else [],
        "model_config": stats.model_config
    }

@app.post("/config")
async def update_config(request: ConfigRequest):
    if request.temperature is not None:
        stats.model_config["temperature"] = request.temperature
    if request.max_tokens is not None:
        stats.model_config["max_tokens"] = request.max_tokens
    if request.model is not None:
        stats.model_config["model"] = request.model
    
    return {"message": "Configuration updated", "config": stats.model_config}

@app.get("/config")
async def get_config():
    return stats.model_config

@app.post("/reset-stats")
async def reset_stats():
    stats.total_chats = 0
    stats.total_tokens = 0
    stats.conversations = []
    stats.response_times = []
    
    # Broadcast reset stats
    stats_data = {
        "total_chats": 0,
        "total_tokens": 0,
        "average_response_time": 0,
        "recent_conversations": [],
        "model_config": stats.model_config
    }
    await manager.broadcast(json.dumps(stats_data))
    
    return {"message": "Stats reset successfully"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)