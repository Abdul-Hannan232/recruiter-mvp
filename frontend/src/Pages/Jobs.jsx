import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, Briefcase, CalendarDays, Search } from "lucide-react";
import { Jobs as JobsApi } from "../services/api.js";

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

function JobCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex gap-4">
        <div className="h-14 w-14 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    JobsApi.list()
      .then((d) => alive && setJobs(Array.isArray(d) ? d : []))
      .catch((e) => alive && setError(e?.response?.data?.detail ?? e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(
    () => jobs.filter((j) => (j.title ?? "").toLowerCase().includes(search.toLowerCase())),
    [jobs, search],
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-slate-900">Open Positions</h1>
        <p className="mt-2 text-slate-500">Find your next role from our active job listings.</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 space-y-5">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Couldn’t load jobs: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
            No open positions{search ? " match your search" : " yet"}.
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Showing {filtered.length} of {jobs.length} jobs
            </p>
            <div className="mt-4 space-y-5">
              {filtered.map((job) => (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    {/* Gradient company-logo placeholder (no more shipped image assets). */}
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-800 to-indigo-900">
                      <Building2 className="h-7 w-7 text-indigo-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xl font-semibold text-slate-900">{job.title}</h2>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Open
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Briefcase size={15} /> {job.department || "General"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin size={15} /> {job.location || "Remote"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={15} /> Posted {fmtDate(job.created_at)}
                        </span>
                      </div>
                      <p className="mt-4 line-clamp-3 text-sm text-slate-600">{job.requirements_text}</p>
                      <div className="mt-5">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="inline-flex rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
