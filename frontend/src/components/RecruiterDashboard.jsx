import { useEffect, useState } from "react";
import { Candidates, Jobs } from "../services/api.js";

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ title: "", description: "" });

  useEffect(() => {
    Jobs.list().then(setJobs).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;
    Candidates.byJob(selected).then(setCandidates).catch(console.error);
  }, [selected]);

  async function createJob(e) {
    e.preventDefault();
    const jd = await Jobs.create(form);
    setJobs((js) => [...js, jd]);
    setForm({ title: "", description: "" });
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-4">
        <h2 className="text-base font-semibold mb-3">Jobs</h2>
        <form onSubmit={createJob} className="space-y-2 mb-4">
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm h-32"
            placeholder="Job description (>=20 chars)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded text-sm">
            Create
          </button>
        </form>
        <ul className="space-y-1">
          {jobs.map((j) => (
            <li key={j.id}>
              <button
                onClick={() => setSelected(j.id)}
                className={`w-full text-left px-2 py-1 rounded text-sm ${
                  selected === j.id ? "bg-slate-700" : "hover:bg-slate-800"
                }`}
              >
                {j.title}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="col-span-8">
        <h2 className="text-base font-semibold mb-3">Candidates</h2>
        {!selected && <p className="text-sm text-slate-400">Pick a job to see candidates.</p>}
        {selected && (
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left py-1">Name</th>
                <th className="text-left">Email</th>
                <th className="text-left">State</th>
                <th className="text-left">Match</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="py-1">{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{c.state}</td>
                  <td>{c.match_score?.toFixed(3) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
