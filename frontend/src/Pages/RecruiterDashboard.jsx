import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, Users, Star, X } from "lucide-react";
import { Jobs, Candidates } from "../services/api.js";

const REC_STYLES = {
  HIRE: "bg-emerald-100 text-emerald-700",
  SHORTLIST: "bg-yellow-100 text-yellow-800",
  REJECT: "bg-rose-100 text-rose-700",
};

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);
  const [graded, setGraded] = useState([]);
  const [form, setForm] = useState({ title: "", requirements_text: "" });
  const [posting, setPosting] = useState(false);
  const [active, setActive] = useState(null); // candidate open in the report modal
  const [busyId, setBusyId] = useState(null);

  const jobTitle = useMemo(() => {
    const m = {};
    jobs.forEach((j) => (m[j.id] = j.title));
    return m;
  }, [jobs]);

  useEffect(() => {
    Jobs.list().then((d) => setJobs(Array.isArray(d) ? d : [])).catch(console.error);
    refreshGraded();
  }, []);

  function refreshGraded() {
    Candidates.graded().then((d) => setGraded(Array.isArray(d) ? d : [])).catch(console.error);
  }

  async function postJob(e) {
    e.preventDefault();
    if (!form.title.trim() || form.requirements_text.trim().length < 20) {
      alert("Title and a job description of at least 20 characters are required.");
      return;
    }
    setPosting(true);
    try {
      const jd = await Jobs.create(form); // POST /jobs -> Agent 1 JD vectorization
      setJobs((js) => [...js, jd]);
      setForm({ title: "", requirements_text: "" });
    } catch (err) {
      alert(`Failed to post job: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setPosting(false);
    }
  }

  // HITL: hire / reject / uncalled("pool"). Re-hydrate by removing the decided row.
  async function decide(action, candidateId) {
    setBusyId(candidateId);
    try {
      await Candidates[action](candidateId);
      setGraded((prev) => prev.filter((c) => c.id !== candidateId));
      setActive(null);
    } catch (err) {
      alert(`Action failed: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const report = active ? safeParse(active.evaluation_summary) : null;

  return (
    <div className="min-h-screen bg-slate-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 rounded-3xl bg-white shadow-xl p-8">
          <p className="text-xl uppercase underline tracking-[0.3em] text-blue-600 font-bold">
            Recruiter Portal
          </p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Post a role. The AI sources, interviews, and grades. You decide.
          </h1>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 mb-8">
          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200 flex items-center gap-4">
            <div className="rounded-2xl bg-blue-100 text-blue-600 p-4"><Users size={24} /></div>
            <div>
              <p className="text-sm text-slate-500">Awaiting your review</p>
              <p className="text-3xl font-bold text-slate-900">{graded.length}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200 flex items-center gap-4">
            <div className="rounded-2xl bg-purple-100 text-purple-600 p-4"><Briefcase size={24} /></div>
            <div>
              <p className="text-sm text-slate-500">Your open roles</p>
              <p className="text-3xl font-bold text-slate-900">{jobs.length}</p>
            </div>
          </div>
        </div>

        {/* Job posting (POST /jobs -> Agent 1 JD vectorization) */}
        <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200 mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">Post a job</h2>
          <form onSubmit={postJob} className="space-y-3">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
              placeholder="Job title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full h-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500"
              placeholder="Paste the job description (min 20 characters)…"
              value={form.requirements_text}
              onChange={(e) => setForm({ ...form, requirements_text: e.target.value })}
            />
            <button
              disabled={posting}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post job"}
            </button>
          </form>
        </div>

        {/* Graded candidate queue (only post-Agent-5, this recruiter only) */}
        <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">Interviewed & graded</h2>
          <p className="text-slate-500 mb-6">
            Candidates the AI has interviewed and scored, ready for your final decision.
          </p>

          {graded.length === 0 ? (
            <p className="text-sm text-slate-400">
              No graded candidates yet. Once the AI finishes interviewing your matches, they appear here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left">Role</th>
                  <th className="text-left">AI Score</th>
                  <th className="text-left">Recommendation</th>
                  <th className="text-left">Report</th>
                </tr>
              </thead>
              <tbody>
                {graded.map((c) => {
                  const rec = safeParse(c.evaluation_summary)?.final_recommendation ?? "—";
                  return (
                    <tr key={c.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{c.full_name}</td>
                      <td className="text-slate-600">{jobTitle[c.job_id] ?? "—"}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                          <Star size={12} /> {c.ai_evaluation_score ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${REC_STYLES[rec] ?? "bg-slate-100 text-slate-600"}`}>
                          {rec}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setActive(c)}
                          className="rounded-2xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Report modal + HITL decision buttons */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
            <button onClick={() => setActive(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700">
              <X />
            </button>

            <h2 className="text-2xl font-bold text-slate-900">{active.full_name}</h2>
            <p className="text-slate-500">{jobTitle[active.job_id] ?? "—"}</p>

            {!report ? (
              <p className="mt-6 text-rose-600">Evaluation summary could not be parsed.</p>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-blue-50 p-5 text-center">
                    <p className="text-sm text-slate-500">Technical</p>
                    <p className="text-4xl font-bold text-blue-700">{report.technical_score}</p>
                  </div>
                  <div className="rounded-2xl bg-violet-50 p-5 text-center">
                    <p className="text-sm text-slate-500">Communication</p>
                    <p className="text-4xl font-bold text-violet-700">{report.communication_score}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">AI recommends:</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${REC_STYLES[report.final_recommendation] ?? "bg-slate-100"}`}>
                    {report.final_recommendation}
                  </span>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-emerald-700 mb-2">Strengths</h3>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">
                      {(report.strengths ?? []).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-rose-700 mb-2">Weaknesses</h3>
                    <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">
                      {(report.weaknesses ?? []).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold text-slate-800 mb-2">Code review</h3>
                  <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
                    {report.code_review || "—"}
                  </p>
                </div>
              </>
            )}

            {/* Human-in-the-loop final decision */}
            <div className="mt-8 flex gap-3 border-t border-slate-200 pt-6">
              <button
                disabled={busyId === active.id}
                onClick={() => decide("hire", active.id)}
                className="flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white"
              >
                Hire
              </button>
              <button
                disabled={busyId === active.id}
                onClick={() => decide("reject", active.id)}
                className="flex-1 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white"
              >
                Reject
              </button>
              <button
                disabled={busyId === active.id}
                onClick={() => decide("uncalled", active.id)}
                className="flex-1 rounded-2xl bg-slate-600 hover:bg-slate-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white"
              >
                Pool
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
