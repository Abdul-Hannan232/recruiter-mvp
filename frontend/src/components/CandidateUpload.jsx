import { useEffect, useState } from "react";
import { Candidates, Jobs } from "../services/api.js";

export default function CandidateUpload() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ job_id: "", full_name: "", email: "", file: null });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Jobs.list().then(setJobs).catch(console.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.file || !form.job_id) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("job_id", form.job_id);
      fd.append("full_name", form.full_name);
      fd.append("email", form.email);
      fd.append("file", form.file);
      const data = await Candidates.upload(fd);
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-base font-semibold mb-3">Apply</h2>
      <form onSubmit={submit} className="space-y-2">
        <select
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
          value={form.job_id}
          onChange={(e) => setForm({ ...form, job_id: e.target.value })}
        >
          <option value="">Select a job…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <input
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
          placeholder="Full name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <input
          type="email"
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="file"
          accept=".pdf,.docx"
          onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
        />
        <button
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1 rounded text-sm"
        >
          {busy ? "Uploading…" : "Submit"}
        </button>
      </form>
      {result && (
        <pre className="mt-4 text-xs bg-slate-900 border border-slate-800 p-3 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
