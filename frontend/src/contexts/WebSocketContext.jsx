import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

const WS_URL = process.env.REACT_APP_BACKEND_URL
  ? process.env.REACT_APP_BACKEND_URL.replace(/^https?/, "wss").replace(/^http/, "ws")
  : "ws://localhost:8001";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { token, user } = useAuth();
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const listeners = useRef([]);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(`${WS_URL}/api/ws/${token}`);

    ws.current.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.current.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setLastMessage(data);
        listeners.current.forEach(fn => fn(data));
      } catch { }
    };

    ws.current.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [token]);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [token, connect]);

  const sendMessage = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const addListener = useCallback((fn) => {
    listeners.current.push(fn);
    return () => {
      listeners.current = listeners.current.filter(l => l !== fn);
    };
  }, []);

  const sendLocation = useCallback((lat, lng, city = "") => {
    sendMessage({ type: "location_update", lat, lng, city });
  }, [sendMessage]);

  return (
    <WebSocketContext.Provider value={{ connected, lastMessage, sendMessage, addListener, sendLocation }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within WebSocketProvider");
  return ctx;
};
