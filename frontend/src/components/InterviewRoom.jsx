import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Interviews } from "../services/api.js";
import { useCodeChannel } from "../hooks/useCodeChannel.js";
import { useRealtime } from "../hooks/useRealtime.js";
import CodeEditor from "./CodeEditor.jsx";

export default function InterviewRoom() {
  const { candidateId } = useParams();
  const { status, connect, disconnect } = useRealtime(candidateId);
  const { ready, send } = useCodeChannel(candidateId);

  const handleCodeChange = useCallback(
    (payload) => {
      if (ready) send({ ...payload, note: "auto-snapshot" });
    },
    [ready, send],
  );

  async function start() {
    await Interviews.start(candidateId);
    await connect();
  }
  async function end() {
    disconnect();
    await Interviews.end(candidateId, { transcript: "(captured client-side)" });
  }

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-7rem)]">
      <aside className="col-span-3 space-y-3">
        <div className="text-sm text-slate-400">Candidate</div>
        <div className="font-mono text-xs break-all">{candidateId}</div>
        <div className="text-sm">
          Realtime: <span className="font-semibold">{status}</span>
        </div>
        <div className="text-sm">
          Code WS: <span className="font-semibold">{ready ? "open" : "closed"}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={start}
            disabled={status === "live" || status === "connecting"}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-1 rounded text-sm"
          >
            Start
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
        <CodeEditor onChange={handleCodeChange} />
      </section>
    </div>
  );
}
