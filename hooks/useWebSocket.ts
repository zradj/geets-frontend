// hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import { AuthService } from '@/services/auth.service';
import { Message } from '@/types/chat';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  "ws://localhost:8000/ws";

interface WebSocketMessage {
  type: 'message.create' | 'message.edit' | 'message.delete' | 'pong';
  payload: any;
}

type MessageCallback = (message: Message, type: 'message.create' | 'message.edit' | 'message.delete') => void;

export function useWebSocket(onMessage: MessageCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const [closedByClient, setClosedByClient] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    setClosedByClient(false);
    const token = AuthService.getToken();
    if (!token) {
      console.error('No token found, cannot connect to WebSocket');
      return;
    }

    try {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', payload: {} }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message.create':
              const newMessage: Message = {
                id: data.payload.id || Date.now().toString(),
                conversation_id: data.payload.conversation_id,
                sender_id: data.payload.sender_id,
                sender_username: data.payload.sender_username,
                body: data.payload.body,
                created_at: data.payload.created_at || new Date().toISOString(),
              };
              onMessage(newMessage, 'message.create');
              break;

            case 'message.edit':
              const editedMessage: Message = {
                id: data.payload.message_id || data.payload.id,
                conversation_id: data.payload.conversation_id,
                sender_id: data.payload.sender_id,
                sender_username: data.payload.sender_username,
                body: data.payload.body,
                created_at: data.payload.created_at || new Date().toISOString(),
                updated_at: data.payload.updated_at || new Date().toISOString(),
              };
              onMessage(editedMessage, 'message.edit');
              break;

            case 'message.delete':
              const deletedMessage: Message = {
                id: data.payload.message_id || data.payload.id,
                conversation_id: data.payload.conversation_id,
                sender_id: data.payload.sender_id || '',
                body: '',
                created_at: '',
              };
              onMessage(deletedMessage, 'message.delete');
              break;

            case 'pong':
              console.log('Pong received');
              break;

            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (!closedByClient) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('Max reconnection attempts reached');
          }
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // CHANGED: Accept variable arguments like ChatService.sendMessage
  const sendMessage = (type: string, payload: Map<string, string>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {      
      wsRef.current.send(JSON.stringify({ type, payload }));
      console.log('Sent:', { type, payload });
    } else {
      console.error('WebSocket is not connected');
      throw new Error('WebSocket is not connected');
    }
  };

  const disconnect = () => {
    // reconnectAttemptsRef.current = maxReconnectAttempts;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      setClosedByClient(true);
    }
  };

  return { isConnected, sendMessage, disconnect };
}