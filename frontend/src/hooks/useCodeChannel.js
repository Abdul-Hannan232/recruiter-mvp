/**
 * useCodeChannel — opens a WebSocket to FastAPI for relaying editor snapshots
 * into the live OpenAI Realtime session as textual context (Agent 4).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useCodeChannel(candidateId) {
  const [ready, setReady] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!candidateId) return undefined;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/code/${candidateId}`);
    wsRef.current = ws;
    ws.onopen = () => setReady(true);
    ws.onclose = () => setReady(false);
    ws.onerror = (e) => console.error("code-ws.error", e);
    return () => ws.close();
  }, [candidateId]);

  const send = useCallback((payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  return { ready, send };
}
