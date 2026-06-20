import { useEffect, useMemo, useState } from "react";
import { Briefcase, Users, Star, Sparkles, FileText } from "lucide-react";
import { Jobs, Candidates } from "../services/api.js";
import ScorecardDrawer from "../components/ScorecardDrawer.jsx";

const REC_STYLES = {
  HIRE: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  SHORTLIST: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  REJECT: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-600/20",
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
  const [form, setForm] = useState({ title: "", requirements_text: "", city: "" });
  const [posting, setPosting] = useState(false);
  const [active, setActive] = useState(null); // candidate open in the scorecard drawer
  const [busyId, setBusyId] = useState(null);
  const [closingId, setClosingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
    if (!form.title.trim() || !form.city.trim() || form.requirements_text.trim().length < 20) {
      alert("Title, city, and a job description of at least 20 characters are required.");
      return;
    }
    setPosting(true);
    try {
      const jd = await Jobs.create(form); // POST /jobs -> Agent 1 JD vectorization
      setJobs((js) => [...js, jd]);
      setForm({ title: "", requirements_text: "", city: "" });
    } catch (err) {
      alert(`Failed to post job: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setPosting(false);
    }
  }

  // HITL: book the final human interview (email-only). The candidate stays in the queue
  // (now FINAL_INTERVIEW_SCHEDULED) so the scorecard remains visible until Hire/Reject —
  // we just refresh its status in place from the returned record.
  async function schedule(candidateId, data) {
    const updated = await Candidates.scheduleFinalInterview(candidateId, data);
    setGraded((prev) => prev.map((c) => (c.id === candidateId ? updated : c)));
  }

  // Close a role: deactivate it + release in-flight candidates to the pool, then refresh
  // the review queue so the reset candidates drop out.
  async function closeJob(id) {
    if (!window.confirm("Close this role? In-flight candidates return to the talent pool.")) {
      return;
    }
    setClosingId(id);
    try {
      const updated = await Jobs.closeJob(id);
      setJobs((js) => js.map((j) => (j.id === id ? updated : j)));
      refreshGraded();
    } catch (err) {
      alert(`Failed to close job: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setClosingId(null);
    }
  }

  // Hard-delete a single role (permanent). Releases its candidates, then drops it locally.
  async function deleteJob(id) {
    if (!window.confirm("Are you sure you want to permanently delete this job?")) {
      return;
    }
    setDeletingId(id);
    try {
      await Jobs.deleteJob(id);
      setJobs((js) => js.filter((j) => j.id !== id));
      refreshGraded();
    } catch (err) {
      alert(`Failed to delete job: ${err?.response?.data?.detail ?? err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  // HITL: hire / reject. Re-hydrate by removing the decided row + closing the drawer.
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

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-12 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 p-8 shadow-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            <Sparkles size={14} /> Recruiter Command Center
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-white">
            Post a role. The AI sources, interviews, and grades. You decide.
          </h1>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl bg-indigo-100 p-4 text-indigo-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Awaiting your review</p>
              <p className="text-3xl font-bold text-slate-900">{graded.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl bg-emerald-100 p-4 text-emerald-600">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Your open roles</p>
              <p className="text-3xl font-bold text-slate-900">
                {jobs.filter((j) => j.is_active).length}
              </p>
            </div>
          </div>
        </div>

        {/* Job posting (POST /jobs -> Agent 1 JD vectorization) */}
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-semibold text-slate-900">Post a job</h2>
          <form onSubmit={postJob} className="space-y-3">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Job title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="City (required location)"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <textarea
              className="h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Paste the job description (min 20 characters)…"
              value={form.requirements_text}
              onChange={(e) => setForm({ ...form, requirements_text: e.target.value })}
            />
            <button
              disabled={posting}
              className="rounded-2xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Post job"}
            </button>
          </form>
        </div>

        {/* Your roles — lifecycle management */}
        {jobs.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">Your roles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-900">{j.title}</h3>
                      <p className="text-sm text-slate-500">{j.city || "—"}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        j.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {j.is_active ? "Active" : "Closed"}
                    </span>
                  </div>
                  {!j.is_active && (
                    <p className="mt-4 text-center text-xs text-slate-400">
                      Role closed — candidates released to pool
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    {j.is_active && (
                      <button
                        onClick={() => closeJob(j.id)}
                        disabled={closingId === j.id}
                        className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        {closingId === j.id ? "Closing…" : "Close Job"}
                      </button>
                    )}
                    <button
                      onClick={() => deleteJob(j.id)}
                      disabled={deletingId === j.id}
                      className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                    >
                      {deletingId === j.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graded candidate queue (PENDING_RECRUITER + FINAL_INTERVIEW_SCHEDULED) */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Interviewed &amp; graded</h2>
          <p className="mb-6 text-slate-500">
            Candidates the AI has interviewed and scored, ready for your final decision.
          </p>

          {graded.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <FileText className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="text-sm text-slate-400">
                No graded candidates yet. Once the AI finishes interviewing your matches, they appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {graded.map((c) => {
                const rec = safeParse(c.evaluation_summary)?.final_recommendation ?? "—";
                return (
                  <div
                    key={c.id}
                    className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{c.full_name}</h3>
                        <p className="text-sm text-slate-500">{jobTitle[c.job_id] ?? "—"}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          REC_STYLES[rec] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300"
                        }`}
                      >
                        {rec}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        <Star size={12} className="text-amber-400" />
                        AI Score {c.ai_evaluation_score ?? "—"}
                      </span>
                      {c.status === "final_interview_scheduled" && (
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                          Scheduled
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => setActive(c)}
                      className="mt-6 w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                    >
                      View Scorecard
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Premium evaluation scorecard + HITL action suite */}
      {active && (
        <ScorecardDrawer
          candidate={active}
          report={safeParse(active.evaluation_summary)}
          jobTitle={jobTitle[active.job_id]}
          busy={busyId === active.id}
          onClose={() => setActive(null)}
          onHire={(id) => decide("hire", id)}
          onReject={(id) => decide("reject", id)}
          onSchedule={schedule}
        />
      )}
    </div>
  );
}
