import { useEffect, useRef, useState } from 'react';
import { ChatStats } from '../types';

export const useWebSocket = (url: string) => {
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      // Don't attempt to reconnect indefinitely
      if (connectionAttempts >= 3) {
        console.log('Max WebSocket connection attempts reached');
        return;
      }

      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        setConnectionAttempts(0);
        // Request initial stats
        ws.current?.send('get_stats');
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStats(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setConnectionAttempts(prev => prev + 1);
        // Reconnect after increasing delays, but only if we haven't exceeded max attempts
        if (connectionAttempts < 3) {
          const delay = Math.min(3000 * Math.pow(2, connectionAttempts), 30000);
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      ws.current?.close();
    };
  }, [url, connectionAttempts]);

  const requestStats = () => {
    if (ws.current && isConnected) {
      ws.current.send('get_stats');
    }
  };

  return { stats, isConnected, requestStats };
};