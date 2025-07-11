export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatStats {
  total_chats: number;
  total_tokens: number;
  average_response_time: number;
  recent_conversations: ConversationHistory[];
  model_config: ModelConfig;
}

export interface ConversationHistory {
  user_message: string;
  assistant_response: string;
  timestamp: string;
  response_time: number;
  tokens: number;
}

export interface ModelConfig {
  temperature: number;
  max_tokens: number;
  model: string;
}

export interface ChatRequest {
  message: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}