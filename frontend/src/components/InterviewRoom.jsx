import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Cpu, Phone, PhoneOff } from "lucide-react";
import { Interviews } from "../services/api.js";
import { useRealtime } from "../hooks/useRealtime.js";
import CodeEditor from "./CodeEditor.jsx";

const STATUS_LABEL = {
  idle: "Ready",
  connecting: "Connecting…",
  live: "Interview Active",
  error: "Connection Error",
  closed: "Interview Ended",
};

/** A single pill in the header status stepper. */
function Step({ label, state }) {
  const wrap =
    state === "active"
      ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/40"
      : state === "done"
        ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/40"
        : "bg-slate-800 text-slate-500 ring-1 ring-inset ring-slate-700";
  const dot =
    state === "active"
      ? "bg-indigo-400 animate-pulse"
      : state === "done"
        ? "bg-emerald-400"
        : "bg-slate-600";
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${wrap}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export default function InterviewRoom() {
  // Phase 4: the candidate arrives via the emailed link /interview?room=<UUID>.
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  // useRealtime resolves room_id -> candidate_id (and flips the candidate to
  // INTERVIEWING) when fetching the token, then exposes candidateId + transcript.
  const { status, connect, disconnect, sendCodeToAI, remoteAudioRef, candidateId, getTranscript } =
    useRealtime(roomId);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const live = status === "live";
  const connecting = status === "connecting";

  const handleCodeSubmit = useCallback(
    // Code goes straight to the live model over the WebRTC data channel; the AI then
    // interrogates it. Throwing surfaces a visible alert via CodeEditor.
    ({ code }) => {
      const ok = sendCodeToAI(code);
      if (!ok) {
        throw new Error("The interview isn't live yet — click Start Interview first.");
      }
    },
    [sendCodeToAI],
  );

  async function start() {
    if (starting || started || !roomId) return;
    setStarting(true);
    try {
      await connect();
      setStarted(true);
    } catch (e) {
      console.error("interview.start failed", e);
    } finally {
      setStarting(false);
    }
  }

  async function end() {
    // Capture the transcript BEFORE tearing down the connection.
    const transcript = getTranscript?.() || "(no transcript captured)";
    disconnect();
    setStarted(false);
    if (candidateId) {
      await Interviews.end(candidateId, { transcript });
    }
  }

  if (!roomId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-400">
        Invalid interview link — no room token found.
      </div>
    );
  }

  // Visualizer orb appearance, reactive to the realtime connection state.
  const orb = live
    ? "bg-gradient-to-br from-emerald-400 to-indigo-500 shadow-[0_0_60px_10px_rgba(16,185,129,0.45)] animate-pulse"
    : connecting
      ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_40px_6px_rgba(245,158,11,0.4)] animate-pulse"
      : status === "error"
        ? "bg-gradient-to-br from-rose-500 to-rose-700 shadow-[0_0_40px_6px_rgba(244,63,94,0.4)]"
        : "bg-gradient-to-br from-slate-600 to-slate-700";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Physical sink for the model's remote audio track. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Slim dark header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600">
            <Cpu size={18} />
          </span>
          <p className="text-sm font-bold">
            Recruiter AI <span className="font-medium text-indigo-400">— Technical Assessment</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Step label="Connecting…" state={connecting ? "active" : live ? "done" : "todo"} />
          <span className="text-slate-600">→</span>
          <Step label="Interview Active" state={live ? "active" : "todo"} />
        </div>
      </header>

      {/* Split pane */}
      <div className="flex min-h-0 flex-1">
        {/* Left: code editor (70%) */}
        <div className="flex min-h-0 w-[70%] flex-col p-4">
          <CodeEditor onSubmit={handleCodeSubmit} />
        </div>

        {/* Right: AI interaction nexus (30%) */}
        <aside className="flex w-[30%] flex-col items-center justify-between border-l border-slate-800 bg-slate-800 p-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
              AI Interviewer
            </p>
            <p className="mt-1 text-sm text-slate-400">{STATUS_LABEL[status] ?? "Ready"}</p>
          </div>

          {/* Pulsing visualizer orb */}
          <div className="relative flex h-44 w-44 items-center justify-center">
            {live && (
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500/20" />
            )}
            <span className={`relative h-28 w-28 rounded-full ${orb}`} />
          </div>

          {/* Call controls */}
          <div className="w-full space-y-3">
            <button
              onClick={start}
              disabled={starting || live || connecting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-40"
            >
              <Phone size={18} /> {starting ? "Starting…" : "Start Interview"}
            </button>
            <button
              onClick={end}
              disabled={!live}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-500 disabled:opacity-40"
            >
              <PhoneOff size={18} /> End Interview
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
