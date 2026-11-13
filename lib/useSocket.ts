'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from './api';
import { clearToken, getToken } from './store';

export interface ServerEvent {
  type: string;
  payload?: Record<string, unknown>;
  ref?: string | null;
}

/**
 * One authenticated WebSocket with keep-alive pings and automatic reconnect.
 * The token goes in the first frame, never in the URL (URLs end up in logs).
 */
export function useSocket(onEvent: (e: ServerEvent) => void, onReconnect: () => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlers = useRef({ onEvent, onReconnect });
  useEffect(() => {
    handlers.current = { onEvent, onReconnect };
  });

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let everConnected = false;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = getToken();
      if (stopped || !token) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', payload: { token } }));

      ws.onmessage = (msg) => {
        let event: ServerEvent;
        try {
          event = JSON.parse(msg.data);
        } catch {
          return;
        }
        if (event.type === 'auth.ok') {
          attempts = 0;
          setConnected(true);
          ping = setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 25_000);
          if (everConnected) handlers.current.onReconnect();
          everConnected = true;
        } else if (event.type !== 'pong') {
          handlers.current.onEvent(event);
        }
      };

      ws.onclose = (e) => {
        clearInterval(ping);
        setConnected(false);
        if (stopped) return;
        if (e.code === 4401) {
          clearToken();
          window.location.assign('/login/');
          return;
        }
        retry = setTimeout(connect, Math.min(15_000, 500 * 2 ** attempts++));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearInterval(ping);
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((type: string, payload: Record<string, unknown>, ref?: string): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type, payload, ref }));
    return true;
  }, []);

  return { connected, send };
}
