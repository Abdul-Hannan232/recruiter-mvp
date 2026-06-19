import { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Mail,
  Award,
  TrendingUp,
  MessageSquare,
} from "lucide-react";

const REC_STYLES = {
  HIRE: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  SHORTLIST: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  REJECT: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-600/20",
};

/** Animated horizontal score bar with an explicit denominator label. */
function ScoreBar({ label, icon: Icon, value, max, gradient, show }) {
  const v = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Icon size={16} className="text-indigo-500" />
          {label}
        </span>
        <span className="text-sm font-bold text-slate-900">
          {v}
          <span className="font-medium text-slate-400"> / {max}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-700 ease-out`}
          style={{ width: show ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

/**
 * Premium slide-in evaluation scorecard for a PENDING_RECRUITER candidate.
 * Houses the visual scoring, structured insights, and the 3-action HITL suite
 * (Hire / Reject & Pool / Reveal Contact).
 */
export default function ScorecardDrawer({
  candidate,
  report,
  jobTitle,
  busy,
  onClose,
  onHire,
  onReject,
}) {
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Trigger the slide-in + bar-fill on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Play the slide-out before asking the parent to unmount.
  function close() {
    setShow(false);
    setTimeout(onClose, 200);
  }

  const rec = report?.final_recommendation ?? "—";
  const strengths = report?.strengths ?? [];
  const weaknesses = report?.weaknesses ?? [];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer panel */}
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-white px-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Evaluation Scorecard
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{candidate.full_name}</h2>
            <p className="text-sm text-slate-500">{jobTitle ?? "—"}</p>
          </div>
          <button
            onClick={close}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mb-6 flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">AI recommendation</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                REC_STYLES[rec] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300"
              }`}
            >
              {rec}
            </span>
          </div>

          {!report ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              The evaluation summary for this candidate could not be parsed.
            </div>
          ) : (
            <>
              {/* Visual scoring */}
              <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <ScoreBar
                  label="Technical"
                  icon={TrendingUp}
                  value={report.technical_score}
                  max={100}
                  gradient="from-indigo-500 to-violet-500"
                  show={show}
                />
                <ScoreBar
                  label="Communication"
                  icon={MessageSquare}
                  value={report.communication_score}
                  max={10}
                  gradient="from-emerald-500 to-teal-500"
                  show={show}
                />
              </div>

              {/* Strengths */}
              <section className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 size={16} /> Strengths
                </h3>
                <ul className="space-y-2">
                  {strengths.length === 0 ? (
                    <li className="text-sm text-slate-400">None recorded.</li>
                  ) : (
                    strengths.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{s}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {/* Weaknesses */}
              <section className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700">
                  <AlertTriangle size={16} /> Weaknesses
                </h3>
                <ul className="space-y-2">
                  {weaknesses.length === 0 ? (
                    <li className="text-sm text-slate-400">None recorded.</li>
                  ) : (
                    weaknesses.map((w, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <span>{w}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {/* Code review analysis */}
              <section className="mt-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                  <Code2 size={16} /> Code Review Analysis
                </h3>
                <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
                  {report.code_review || "No code analysis on file."}
                </pre>
              </section>
            </>
          )}
        </div>

        {/* Sticky HITL action suite */}
        <div className="space-y-3 border-t border-slate-200 bg-white px-8 py-5">
          {revealed ? (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <Mail size={16} className="shrink-0 text-indigo-600" />
              <a
                href={`mailto:${candidate.email}`}
                className="truncate font-mono text-sm font-medium text-indigo-700 hover:underline"
              >
                {candidate.email}
              </a>
            </div>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Mail size={16} /> Reveal Contact
            </button>
          )}

          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => onHire(candidate.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Award size={18} /> {busy ? "Working…" : "Hire Candidate"}
            </button>
            <button
              disabled={busy}
              onClick={() => onReject(candidate.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-500 disabled:opacity-50"
            >
              <X size={18} /> Reject &amp; Pool
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
