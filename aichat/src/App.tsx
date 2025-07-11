import React, { useState, useEffect } from 'react';
import { MessageSquare, BarChart3, Settings, Trash2 } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import ModelConfig from './components/ModelConfig';
import { ChatMessage, ModelConfig as ModelConfigType } from './types';
import { api } from './services/api';
import { useWebSocket } from './hooks/useWebSocket';

type TabType = 'chat' | 'dashboard' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfigType | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [systemPrompt, setSystemPrompt] = useState<string>('You are a helpful assistant.');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // WebSocket connection for real-time stats
  const wsUrl = import.meta.env.VITE_PORT_8000 
    ? import.meta.env.VITE_PORT_8000.replace('http', 'ws') + '/ws'
    : 'ws://localhost:8000/ws';
  const { stats, isConnected, requestStats } = useWebSocket(wsUrl);

  // Load initial configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setBackendError(null);
        const config = await api.getConfig();
        setModelConfig(config);
      } catch (error) {
        console.error('Failed to load config:', error);
        setBackendError('Backend server is not available. Some features may be limited.');
        // Set default config when backend is unavailable
        setModelConfig({
          temperature: 0.7,
          max_tokens: 1000,
          model: 'gpt-3.5-turbo'
        });
      }
    };
    loadConfig();
  }, []);

  const handleSendMessage = async (messageText: string) => {
    if (isStreaming || backendError) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setCurrentStreamingMessage(assistantMessage);

    try {
      const controller = new AbortController();
      setAbortController(controller);

      const stream = await api.sendMessage({
        message: messageText,
        temperature: modelConfig?.temperature,
        max_tokens: modelConfig?.max_tokens,
        system_prompt: systemPrompt,
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                setIsStreaming(false);
                setCurrentStreamingMessage(null);
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, isStreaming: false }
                    : msg
                ));
                break;
              } else {
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessage.id 
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ));
              }
            } catch (error) {
              console.error('Error parsing stream data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setBackendError('Failed to connect to backend server');
      setIsStreaming(false);
      setCurrentStreamingMessage(null);
      // Update the assistant message with error info instead of removing it
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Sorry, I cannot respond right now. The backend server is not available.', isStreaming: false }
          : msg
      ));
    } finally {
      setAbortController(null);
    }
  };

  const handleStopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsStreaming(false);
    setCurrentStreamingMessage(null);
    
    // Remove the streaming indicator from the current message
    setMessages(prev => prev.map(msg => 
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ));
  };

  const handleUpdateConfig = async (config: Partial<ModelConfigType>) => {
    try {
      setBackendError(null);
      const updatedConfig = await api.updateConfig(config);
      setModelConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update config:', error);
      setBackendError('Failed to update configuration. Backend server is not available.');
      // Update local config optimistically
      setModelConfig(prev => prev ? { ...prev, ...config } : null);
    }
  };

  const handleResetStats = async () => {
    try {
      setBackendError(null);
      await api.resetStats();
      requestStats();
    } catch (error) {
      console.error('Failed to reset stats:', error);
      setBackendError('Failed to reset stats. Backend server is not available.');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setIsStreaming(false);
    setCurrentStreamingMessage(null);
  };

  // Export chat as text file
  const handleExportChat = () => {
    if (messages.length === 0) return;
    const text = messages.map(msg => `[${msg.role.toUpperCase()}] ${msg.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle file upload (PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are supported for now.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      setIsStreaming(true);
      const response = await fetch('http://localhost:8000/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.summary || 'No summary available.',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Failed to analyze PDF.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm border-b border-gray-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Chatbot</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {backendError ? 'Backend Offline' : isConnected ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={() => setIsDark((d) => !d)}
              className="ml-4 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors text-sm font-semibold"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
            {backendError && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-sm text-yellow-800">Limited Mode</span>
              </div>
            )}
            {activeTab === 'chat' && (
              <button
                onClick={handleClearChat}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-200 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                <span>Clear Chat</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          {/* Main Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 overflow-hidden">
            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-200px)] flex flex-col">
                <div className="flex justify-end p-2 space-x-2">
                  <button
                    onClick={handleExportChat}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold"
                  >
                    Export Chat
                  </button>
                  <label className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold cursor-pointer">
                    Upload PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                <ChatInterface
                  messages={messages}
                  isStreaming={isStreaming}
                  onSendMessage={handleSendMessage}
                  onStopStreaming={handleStopStreaming}
                />
              </div>
            )}
            {activeTab === 'dashboard' && (
              <Dashboard
                stats={stats}
                onResetStats={handleResetStats}
              />
            )}
            {activeTab === 'settings' && (
              <div className="p-6 space-y-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
                    rows={3}
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    placeholder="e.g. You are a helpful assistant."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This prompt sets the behavior/personality of the AI for this session.
                  </p>
                </div>
                <ModelConfig
                  config={modelConfig}
                  onUpdateConfig={handleUpdateConfig}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;