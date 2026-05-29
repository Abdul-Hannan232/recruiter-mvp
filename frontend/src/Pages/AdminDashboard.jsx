import React, { useMemo, useState } from 'react';
import { Search, Users, Briefcase, Layers, ClipboardList, ShieldCheck, BarChart3 } from 'lucide-react';

const AdminDashboard = () => {
  const [search, setsearch] = useState('');

  const stats = useMemo(
    () => [
      { title: 'Recruiters', value: 25, icon: <Users size={24} />, bg: 'bg-blue-100', color: 'text-blue-600' },
      { title: 'Candidates', value: 128, icon: <Briefcase size={24} />, bg: 'bg-green-100', color: 'text-green-600' },
      { title: 'Open Jobs', value: 32, icon: <Layers size={24} />, bg: 'bg-purple-100', color: 'text-purple-600' },
      { title: 'Applications', value: 243, icon: <ClipboardList size={24} />, bg: 'bg-orange-100', color: 'text-orange-600' },
    ],
    [],
  );

  const recruiters = useMemo(
    () => [
      { id: 1, name: 'Ahmed Malik', company: 'Nexa Tech', roleCount: 9, email: 'ahmed@nexa.tech', status: 'Active' },
      { id: 2, name: 'Sara Hussain', company: 'BrightMetrics', roleCount: 4, email: 'sara@brightmetrics.com', status: 'Active' },
      { id: 3, name: 'Uzma Shah', company: 'Aspire AI', roleCount: 7, email: 'uzma@aspire.ai', status: 'Reviewing' },
      { id: 4, name: 'Bilal Rafi', company: 'TalentPulse', roleCount: 5, email: 'bilal@talentpulse.io', status: 'Paused' },
      { id: 5, name: 'Mehwish Ali', company: 'FutureWorks', roleCount: 6, email: 'mehwish@futureworks.co', status: 'Active' },
    ],
    [],
  );

  const candidates = useMemo(
    () => [
      { id: 1, name: 'Ahmed Khan', position: 'Frontend Engineer', experience: '3 years', status: 'Interview', score: 92 },
      { id: 2, name: 'Sara Khan', position: 'Data Analyst', experience: '2 years', status: 'Offer', score: 87 },
      { id: 3, name: 'Ayesha Malik', position: 'DevOps Engineer', experience: '4 years', status: 'Shortlisted', score: 90 },
      { id: 4, name: 'Imran Qureshi', position: 'Mobile Developer', experience: '5 years', status: 'Applied', score: 84 },
      { id: 5, name: 'Maryam Noor', position: 'UX Designer', experience: '3 years', status: 'Review', score: 89 },
    ],
    [],
  );

  const filter_Recruiters = recruiters.filter((item) =>
    [item.name, item.company, item.email, item.status].
    join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  const filter_Candidates = candidates.filter((item) =>
    [item.name, item.position, item.experience, item.status].
    join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 rounded-3xl bg-white shadow-xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xl uppercase underline tracking-[0.3em] text-blue-600 font-bold">
                Admin Portal </p>
              <h1 className="mt-4 text-4xl font-bold text-slate-900"> Manage recruiters, candidates, and hiring 
                operations. </h1>
              <p className="mt-4 text-slate-600 max-w-2xl leading-7">
                This dashboard gives you a complete view of recruiter activity, candidate progress, and hiring 
                health across the platform.
              </p>
            </div>
            
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500"> Admin controls </p>
              <p className="mt-3 text-3xl font-bold text-slate-900"> Real-time platform insights </p>
              <p className="mt-2 text-slate-600">Monitor and manage data for recruiters and candidates from 
                one place.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-4 mb-8">
          {
            stats.map((stat) => (
                <div key={stat.title} className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
                <div className={`inline-flex items-center justify-center rounded-2xl p-4 ${stat.bg} ${stat.color}`}>
                    {stat.icon}
                </div>
                <p className="mt-5 text-sm text-slate-500">{stat.title}</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
            ))
          }
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200 mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 underline">Platform overview</h2>
              <p className="mt-2 text-slate-500">Search across recruiters and candidates, and review current status details.</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setsearch(e.target.value)}
                placeholder="Search recruiters or candidates"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm
                text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <section className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 underline">Recruiter management</h3>
                <p className="mt-2 text-slate-500">View recruiter accounts, active roles, and current status.</p>
              </div>
            </div>

            <div className="space-y-4">
              {filter_Recruiters.map((r) => (
                <div key={r.id} className="rounded-3xl border border-slate-500 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{r.name}</p>
                      <p className="text-sm text-slate-500">{r.company}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold
                       text-blue-700">{r.status}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium
                       text-slate-600">{r.roleCount} jobs</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">Email: {r.email}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 underline">Candidate monitoring</h3>
                <p className="mt-2 text-slate-500">Track candidate progress through the recruitment pipeline.</p>
              </div>
            </div>
            <div className="space-y-4">
              {filter_Candidates.map((candidate) => (
                <div key={candidate.id} className="rounded-3xl border border-slate-500 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{candidate.name}</p>
                      <p className="text-sm text-slate-500">{candidate.position} · {candidate.experience}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{candidate.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">Match score: {candidate.score}%</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900">Platform health</h3>
            <p className="mt-3 text-slate-600">Use this summary to check active data points for recruiters and candidates.</p>
            <ul className="mt-6 space-y-4 text-slate-600">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-blue-600" />
                <span>25 active recruiters with live job postings.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-green-600" />
                <span>128 candidates currently in the pipeline.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-purple-600" />
                <span>32 open jobs across all recruiters.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900">Admin actions</h3>
            <p className="mt-3 text-slate-600">Quick tasks for managing platform users and approvals.</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">Approve new recruiters and review assigned job postings.</div>
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">Verify candidate profiles before recommending them to recruiters.</div>
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">Compare recruiter performance and hiring speed by company.</div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900">Data snapshot</h3>
            <p className="mt-3 text-slate-600">A single place to see both recruiter and candidate details.</p>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              <div className="rounded-3xl bg-slate-50 p-4">Total recruiter accounts: 25</div>
              <div className="rounded-3xl bg-slate-50 p-4">Total candidate accounts: 128</div>
              <div className="rounded-3xl bg-slate-50 p-4">Total applications: 243</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
