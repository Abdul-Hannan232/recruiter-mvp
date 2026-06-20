import { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Mail,
  MapPin,
  Award,
  TrendingUp,
  MessageSquare,
  CalendarDays,
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
  onSchedule,
}) {
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleErr, setScheduleErr] = useState(null);
  const [scheduled, setScheduled] = useState(false);

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

  async function submitSchedule() {
    if (!scheduledTime) {
      setScheduleErr("Please choose a date and time.");
      return;
    }
    setScheduling(true);
    setScheduleErr(null);
    try {
      // datetime-local is local time; send a UTC ISO string the backend can parse.
      await onSchedule(candidate.id, {
        scheduled_time: new Date(scheduledTime).toISOString(),
        meeting_link: meetingLink.trim() || null,
      });
      setScheduled(true);
      setShowSchedule(false);
    } catch (err) {
      setScheduleErr(err?.response?.data?.detail ?? err.message);
    } finally {
      setScheduling(false);
    }
  }

  // Only the AI-vetted, awaiting-decision candidates can be booked for a final interview.
  const isPending = candidate.status === "pending_recruiter";
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
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <MapPin size={13} /> {candidate.city || "Location unknown"}
            </p>
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
                  max={10}
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

          {scheduled || candidate.status === "final_interview_scheduled" ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} /> Interview Scheduled
            </div>
          ) : (
            isPending && (
              <button
                onClick={() => setShowSchedule(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
              >
                <CalendarDays size={16} /> Schedule Final
              </button>
            )
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

      {/* Schedule Final Interview modal (email-only handoff — no calendar OAuth) */}
      {showSchedule && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <CalendarDays size={18} className="text-indigo-600" /> Schedule Final Interview
              </h3>
              <button
                onClick={() => setShowSchedule(false)}
                className="text-slate-400 transition hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              An email invite goes to {candidate.full_name}, CC’ing you on the same thread.
            </p>

            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Proposed date &amp; time
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Meeting link (optional)
            </label>
            <input
              type="text"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://…"
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />

            {scheduleErr && <p className="mb-3 text-sm text-rose-600">{scheduleErr}</p>}

            <div className="flex gap-3">
              <button
                onClick={submitSchedule}
                disabled={scheduling}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {scheduling ? "Sending…" : "Send Invite"}
              </button>
              <button
                onClick={() => setShowSchedule(false)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
