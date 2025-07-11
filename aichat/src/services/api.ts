import { ChatRequest, ChatStats, ModelConfig } from '../types';

const API_BASE_URL = import.meta.env.VITE_PORT_8000 || 'http://localhost:8000';

export const api = {
  async sendMessage(request: ChatRequest): Promise<ReadableStream> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      return response.body;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - backend server may be unavailable');
      }
      throw error;
    }
  },

  async getStats(): Promise<ChatStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - backend server may be unavailable');
      }
      throw error;
    }
  },

  async updateConfig(config: Partial<ModelConfig>): Promise<ModelConfig> {
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.config;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - backend server may be unavailable');
      }
      throw error;
    }
  },

  async getConfig(): Promise<ModelConfig> {
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - backend server may be unavailable');
      }
      throw error;
    }
  },

  async resetStats(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/reset-stats`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - backend server may be unavailable');
      }
      throw error;
    }
  },
};