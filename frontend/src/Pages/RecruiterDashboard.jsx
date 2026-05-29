import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Briefcase, TrendingUp, Users, Search, Funnel, ArrowRight, MessageSquare, Star } from 'lucide-react';
import { Jobs, Candidates } from '../services/api.js';

const RecruiterDashboard = () => {
  const [search, set_Search] = useState('');
  const [filter_Status, setfilter_Status] = useState('All');

  // Live backend data (no auth phase): jobs -> auto-select first -> its candidates.
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [candidates, setCandidates] = useState([]);

  // 1. Fetch all jobs on mount, then auto-select the first one.
  useEffect(() => {
    Jobs.list()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setJobs(list);
        if (list.length > 0) setSelectedJobId(list[0].id);
      })
      .catch((err) => console.error('Jobs.list() failed:', err));
  }, []);

  // 2. Fetch candidates whenever the selected job changes.
  useEffect(() => {
    if (!selectedJobId) return;
    Candidates.byJob(selectedJobId)
      .then((data) => setCandidates(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Candidates.byJob() failed:', err));
  }, [selectedJobId]);

  // Map backend CandidateRead -> the shape this UI renders. Fields the API does
  // not provide (role, skills) are dropped.
  const mappedCandidates = useMemo(
    () =>
      candidates.map((c) => ({
        id: c.id,
        name: c.full_name,
        status: c.status,
        score: c.ai_evaluation_score,
      })),
    [candidates],
  );

  const stats = [
    { title: 'Total Candidates', value: candidates.length, icon: <Users size={24} />, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Open Roles', value: jobs.length, icon: <Briefcase size={24} />, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Interviews', value: candidates.filter((c) => c.status === 'interview_scheduled').length, icon: <Calendar size={24} />, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Match Score', value: candidates.filter((c) => c.status === 'matched').length, icon: <TrendingUp size={24} />, bg: 'bg-orange-100', color: 'text-orange-600' },
  ];

  const filteredCandidates = mappedCandidates.filter((c) => {
    const matches_Search = [c.name, c.status]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());

    const matches_Status = filter_Status === 'All' || c.status === filter_Status;
    return matches_Search && matches_Status;
  });

  console.log('Jobs State:', jobs);
  console.log('Candidates State:', candidates);

  return (
    <div className="min-h-screen bg-slate-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 rounded-3xl bg-white shadow-xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xl uppercase underline tracking-[0.3em] text-blue-600 font-bold">Recruiter Portal</p>
              <h1 className="mt-4 text-4xl font-bold text-slate-900">Manage talent, speed hiring, and visualize outcomes.</h1>
              <p className="mt-4 text-slate-600 max-w-2xl leading-7">
                Monitor candidate flow, review talent matches, and coordinate interviews from a single modern dashboard.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">Active hiring campaign</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">15 roles live</p>
              <p className="mt-2 text-slate-600">14 new candidate matches today</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-4 mb-8">
          {stats.map((s) => (
            <div key={s.title} className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
              <div className={`inline-flex items-center justify-center rounded-2xl p-4 ${s.bg} ${s.color}`}>
                {s.icon}
              </div>
              <p className="mt-5 text-sm text-slate-500">{s.title}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 underline"> Candidate pipeline </h2>
                <p className="text-slate-500 mt-2">Track your most promising applicants and move them through 
                    hiring quickly. </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3 text-slate-400" />
                  <input value={search} onChange={(e) => set_Search(e.target.value)}
                    placeholder="Search the candidates here...."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm
                     text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">Status:</span>
                  <select value={filter_Status} onChange={(e) => setfilter_Status(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900
                     outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" >
                    <option value="All">All</option>
                    <option value="pool">Pool</option>
                    <option value="matched">Matched</option>
                    <option value="outreach_sent">Outreach Sent</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="interview_scheduled">Interview Scheduled</option>
                    <option value="interview_completed">Interview Completed</option>
                    <option value="pending_recruiter">Pending Recruiter</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredCandidates.map((c) => (
                <div key={c.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm
                 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900"> {c.name} </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm
                        font-semibold text-blue-700">
                        {c.status}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1
                        text-sm font-semibold text-white">
                        <Star size={14} /> {c.score ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500"> Quick actions </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900"> Recruiter controls </h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <Briefcase className="text-purple-600" />
                <div>
                  <p className="text-sm text-slate-500"> New role live </p>
                  <p className="font-semibold text-slate-900"> Senior Product Designer </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <Calendar className="text-green-600" />
                <div>
                  <p className="text-sm text-slate-500"> Next interview </p>
                  <p className="font-semibold text-slate-900"> Wed, Apr 16 · 11:30 AM </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <MessageSquare className="text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500"> Messages </p>
                  <p className="font-semibold text-slate-900"> 8 unread replies </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
export default RecruiterDashboard;