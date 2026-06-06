import React, { useRef, useState } from "react";
import { Candidates } from "../services/api.js";

const ACCEPT = ".pdf,.docx";

export default function CandidatePortal() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function pick(selected) {
    if (!selected) return;
    setError(null);
    setFile(selected);
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await Candidates.uploadMyResume(fd); // Agent 1: parse + embed + pool
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.detail ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  // Permanent success state — honest to the Zero-Click model (no applications/stats).
  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 pt-24 pb-12">
        <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900">You're in the global talent pool</h1>
          <p className="mt-4 leading-7 text-slate-600">
            We will reach out when an AI matches you with a role. There's nothing else to do —
            no applications, no searching. Sit tight.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4 pt-24 pb-12">
      <div className="w-full max-w-lg rounded-3xl bg-white p-10 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-slate-900">Join the talent pool</h1>
        <p className="mt-3 text-center text-slate-600">
          Upload your resume once. Our AI does the rest — matching, outreach, and interviews.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="font-medium text-slate-900">{file.name}</p>
          ) : (
            <>
              <p className="font-medium text-slate-700">Drop your resume here</p>
              <p className="mt-1 text-sm text-slate-500">or click to browse · PDF or DOCX</p>
            </>
          )}
        </div>

        {error && <p className="mt-4 text-center text-sm text-rose-600">{error}</p>}

        <button
          onClick={submit}
          disabled={!file || busy}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Submit resume"}
        </button>
      </div>
    </div>
  );
}
