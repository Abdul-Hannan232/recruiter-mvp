import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_SNIPPET = `// Solve the problem here.\nfunction solve(input) {\n  return input;\n}\n`;

export default function CodeEditor({ language = "javascript", onChange, debounceMs = 800 }) {
  const [code, setCode] = useState(DEFAULT_SNIPPET);
  const timer = useRef(null);

  useEffect(() => {
    if (!onChange) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ language, code }), debounceMs);
    return () => timer.current && clearTimeout(timer.current);
  }, [code, language, onChange, debounceMs]);

  return (
    <div className="h-full w-full border border-slate-800 rounded">
      <Editor
        height="100%"
        defaultLanguage={language}
        value={code}
        onChange={(v) => setCode(v ?? "")}
        theme="vs-dark"
        options={{ fontSize: 13, minimap: { enabled: false } }}
      />
    </div>
  );
}
