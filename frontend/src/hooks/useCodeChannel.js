/**
 * useCodeChannel — opens a WebSocket to FastAPI for relaying editor snapshots
 * into the live OpenAI Realtime session as textual context (Agent 4).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useCodeChannel(candidateId, enabled = false) {
  const [ready, setReady] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Deferred until `enabled`: the backend WS guard closes (1008) any candidate
    // not yet in INTERVIEWING, so we must wait for /start to resolve first.
    if (!candidateId || !enabled) return undefined;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/code/${candidateId}`);
    wsRef.current = ws;
    ws.onopen = () => setReady(true);
    ws.onclose = () => setReady(false);
    ws.onerror = (e) => console.error("code-ws.error", e);
    return () => ws.close();
  }, [candidateId, enabled]);

  const send = useCallback((payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  return { ready, send };
}
