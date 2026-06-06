import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_SNIPPET = `// Solve the problem here.\nfunction solve(input) {\n  return input;\n}\n`;

export default function CodeEditor({
  language = "javascript",
  onChange,
  onSubmit,
  canSubmit = false,
  debounceMs = 800,
}) {
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
    if (!onSubmit || submitting) return;
    setSubmitting(true);
    try {
      // Explicit, durable Single-Write through the backend.
      await onSubmit({ language, code });
      setSubmittedAt(new Date());
    } catch (e) {
      console.error("code.submit failed", e);
      alert(`Submit failed: ${e?.response?.data?.detail ?? e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col border border-slate-800 rounded">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-xs text-slate-400">{language}</span>
        <div className="flex items-center gap-3">
          {submittedAt && (
            <span className="text-xs text-emerald-400">
              Submitted {submittedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1 rounded text-xs"
          >
            {submitting ? "Submitting…" : "Submit code"}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage={language}
          value={code}
          onChange={(v) => setCode(v ?? "")}
          theme="vs-dark"
          options={{ fontSize: 13, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}
