import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Building2, CalendarDays, ArrowLeft } from "lucide-react";
import { Jobs as JobsApi } from "../services/api.js";
import { useAuth } from "../context/AuthContext";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

const JobDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    JobsApi.get(id)
      .then((d) => alive && setJob(d))
      .catch((e) =>
        alive &&
        setError(
          e?.response?.status === 404 ? "not_found" : e?.response?.data?.detail ?? e.message,
        ),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Apply Now: logged-in candidates go to their portal; everyone else to signup.
  const apply = () => navigate(isAuthenticated ? "/candidate" : "/signup");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600"
        >
          <ArrowLeft size={16} /> Back to Jobs
        </Link>

        {loading ? (
          <div className="mt-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-8">
            <div className="h-32 rounded-xl bg-slate-200" />
            <div className="mt-6 h-6 w-1/2 rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-5/6 rounded bg-slate-100" />
              <div className="h-3 w-4/6 rounded bg-slate-100" />
            </div>
          </div>
        ) : error === "not_found" ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-slate-900">This job could not be found.</p>
            <p className="mt-1 text-sm text-slate-500">It may have been closed or removed.</p>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Couldn’t load this job: {error}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Gradient banner placeholder (replaces the old multi-MB image asset). */}
            <div className="flex items-center gap-4 bg-gradient-to-br from-slate-800 to-indigo-900 p-8">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15">
                <Building2 className="h-8 w-8 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-indigo-200">
                  <CalendarDays size={15} /> Posted {fmtDate(job.created_at)}
                </p>
              </div>
            </div>

            <div className="p-8">
              <h2 className="text-lg font-bold text-slate-900">Job Description</h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-600">
                {job.requirements_text}
              </p>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <button
                  onClick={apply}
                  className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  Apply Now
                </button>
                {!isAuthenticated && (
                  <p className="mt-2 text-xs text-slate-400">
                    You’ll be asked to create a candidate account to apply.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetailsPage;
