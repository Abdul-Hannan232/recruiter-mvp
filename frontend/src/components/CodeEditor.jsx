import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_SNIPPET = `// Solve the problem here.\nfunction solve(input) {\n  return input;\n}\n`;

export default function CodeEditor({ language = "javascript", onChange, onSubmit, debounceMs = 800 }) {
  const [code, setCode] = useState(DEFAULT_SNIPPET);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!onChange) return;
    if (timer.current) clearTimeout(timer.current);
    // Debounced auto-snapshot: ephemeral live context for the model (not persisted).
    timer.current = setTimeout(() => onChange({ language, code }), debounceMs);
    return () => timer.current && clearTimeout(timer.current);
  }, [code, language, onChange, debounceMs]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Explicit, durable Single-Write through the backend.
      await onSubmit?.({ language, code });
      setSubmittedAt(new Date());
    } catch (e) {
      console.error("code.submit failed", e);
      alert(`Submit failed: ${e?.response?.data?.detail ?? e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Bounded height + overflow-hidden so the flex children (editor + footer) stay
    // inside the box and the footer can't be pushed off-screen.
    <div className="flex h-full w-full flex-col overflow-hidden rounded border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="text-xs text-slate-400">{language}</span>
        {submittedAt && (
          <span className="text-xs text-emerald-400">
            Submitted {submittedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Editor — the only scrollable region (flex-1 + min-h-0) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          onChange={(v) => setCode(v ?? "")}
          theme="vs-dark"
          options={{ fontSize: 13, minimap: { enabled: false } }}
        />
      </div>

      {/* Sticky footer pinned to the bottom of the code box. High z-index + solid bg
          so the app navbar/footer can never cover the Submit button. Always visible. */}
      <div className="sticky bottom-0 z-30 border-t border-slate-700 bg-slate-900 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Code for AI Review"}
        </button>
      </div>
    </div>
  );
}
