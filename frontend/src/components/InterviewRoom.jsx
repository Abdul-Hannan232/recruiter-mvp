import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Interviews } from "../services/api.js";
import { useCodeChannel } from "../hooks/useCodeChannel.js";
import { useRealtime } from "../hooks/useRealtime.js";
import CodeEditor from "./CodeEditor.jsx";

export default function InterviewRoom() {
  // Phase 4: the candidate arrives via the emailed link /interview?room=<UUID>.
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  // useRealtime resolves room_id -> candidate_id (and transitions the candidate to
  // INTERVIEWING) when fetching the token, then exposes candidateId for downstream calls.
  const { status, connect, disconnect, remoteAudioRef, candidateId, getTranscript } =
    useRealtime(roomId);
  // The code WS is gated on `started` + a resolved candidateId, so it only opens AFTER
  // the token call has moved the candidate to INTERVIEWING (else the WS guard 1008s).
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const { ready, send } = useCodeChannel(candidateId, started && Boolean(candidateId));

  const handleCodeChange = useCallback(
    (payload) => {
      // Ephemeral live context: feed the model as the candidate types (not persisted).
      if (ready) send({ ...payload, note: "auto-snapshot" });
    },
    [ready, send],
  );

  const handleCodeSubmit = useCallback(
    // Durable Single-Write: backend persists then forwards to the live model.
    ({ language, code }) =>
      Interviews.submitCode(candidateId, { language, code, note: "explicit-submit" }),
    [candidateId],
  );

  async function start() {
    // Re-entry guard: ignore extra clicks while a start is already in flight.
    if (starting || started || !roomId) return;
    setStarting(true);
    try {
      // The room token endpoint itself validates SHORTLISTED + flips to INTERVIEWING,
      // so connect() (which fetches that token) is the single start action.
      await connect();
      setStarted(true); // now safe to open the code WS
    } catch (e) {
      console.error("interview.start failed", e);
    } finally {
      setStarting(false);
    }
  }
  async function end() {
    // Capture the accumulated transcript BEFORE tearing down the connection.
    const transcript = getTranscript() || "(no transcript captured)";
    disconnect();
    setStarted(false); // closes the code WS
    if (candidateId) {
      await Interviews.end(candidateId, { transcript });
    }
  }

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)] text-slate-400">
        Invalid interview link — no room token found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-7rem)]">
      {/* Physical sink for the model's remote audio track. A mounted element
          with autoPlay is far more reliable than an in-memory Audio() created
          mid-handshake. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <aside className="col-span-3 space-y-3">
        <div className="text-sm text-slate-400">Interview Room</div>
        <div className="font-mono text-xs break-all">{roomId}</div>
        <div className="text-sm text-slate-400">Candidate</div>
        <div className="font-mono text-xs break-all">{candidateId ?? "—"}</div>
        <div className="text-sm">
          Realtime: <span className="font-semibold">{status}</span>
        </div>
        <div className="text-sm">
          Code WS: <span className="font-semibold">{ready ? "open" : "closed"}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={start}
            disabled={starting || started || status === "live" || status === "connecting"}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-1 rounded text-sm"
          >
            {starting ? "Starting…" : "Start"}
          </button>
          <button
            onClick={end}
            disabled={status !== "live"}
            className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-3 py-1 rounded text-sm"
          >
            End
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Audio flows directly between your browser and OpenAI via WebRTC using a
          short-lived ephemeral token. The server only relays code-editor snapshots
          over a separate WebSocket as textual context for the model.
        </p>
      </aside>
      <section className="col-span-9">
        <CodeEditor
          onChange={handleCodeChange}
          onSubmit={handleCodeSubmit}
          canSubmit={status === "live" && Boolean(candidateId)}
        />
      </section>
    </div>
  );
}
