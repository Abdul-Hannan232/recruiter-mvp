import React, { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, CheckCircle2, Clock, Heart, Search, X, Brain } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CandidateDashboard = () => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [aiModal, setAiModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    interviewer: '',
    location: ''
  });

  const [search, setsearch] = useState('');
  const stats = [
    {
      title: 'Applications', value: 7, icon: <Bookmark size={24} />,
      bg: 'bg-blue-100', color: 'text-blue-600'
    },

    {
      title: 'Interviews', value: 3, icon: <Clock size={24} />,
      bg: 'bg-green-100', color: 'text-green-600'
    },

    {
      title: 'Offers', value: 1, icon: <CheckCircle2 size={24} />,
      bg: 'bg-purple-100', color: 'text-purple-600'
    },

    {
      title: 'Match Rate', value: '88%', icon: <Heart size={24} />,
      bg: 'bg-pink-100', color: 'text-pink-600'
    },
  ];

  const applications = useMemo(
    () => [
      {
        id: 1, title: 'Frontend Developer', company: 'Pulse Labs', score: "87%",
        status: 'Under Review', submitted: 'Apr 1, 2026'
      },
      {
        id: 2, title: 'Data Analyst', company: 'BrightMetric', score: "92%",
        status: 'Interview Scheduled', submitted: 'Mar 28, 2026'
      },
      {
        id: 3, title: 'Mobile App Engineer', company: 'Nova Apps', score: "75%",
        status: 'New', submitted: 'Apr 5, 2026'
      },
      {
        id: 4, title: 'AI Research Associate', company: 'Vertex AI', score: "95%",
        status: 'Offer', submitted: 'Mar 18, 2026'
      },
    ],
    [],
  );

  const filteredApplications = applications.filter((item) =>
    [item.title, item.company, item.status, item.score]
      .join(' ').toLowerCase()
      .includes(search.toLowerCase()),
  );

  const openAiModal = (application) => {
    setSelectedCandidate(application);
    setAiModal(true);
  };

  const closeAiModal = () => {
    setAiModal(false);
  };

  const openScheduleModal = (application) => {
    setSelectedCandidate(application);
    setScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setScheduleModal(false);
    setFormData({ date: '', time: '', interviewer: '', location: '' });
  };

  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    const { date, time, interviewer, location } = formData;
    if (!date || !time || !interviewer || !location) {
      toast.error('Error! Please fill all the fields to schedule the interview.');
      return;
    }

    toast.success(`Congratulations! Interview successfully scheduled for ${selectedCandidate.title}`);
    closeScheduleModal();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 rounded-3xl bg-white shadow-xl p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xl uppercase tracking-[0.3em] text-blue-600 font-bold underline">
                Candidate Portal </p>
              <h1 className="mt-4 text-4xl font-bold text-slate-900"> Your Career Dashboard </h1>
              <p className="mt-4 text-slate-600 max-w-2xl leading-7">
                Stay on top of your active applications, upcoming interviews, and recruiter feedback with a
                clean candidate experience.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500"> Profile strength </p>
              <p className="mt-3 text-3xl font-bold text-slate-900"> 92% </p>
              <p className="mt-2 text-slate-600">Your resume is optimized for recommended roles.</p>
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
                <p className="mt-5 text-sm text-slate-500"> {stat.title} </p>
                <p className="mt-3 text-3xl font-bold text-slate-900"> {stat.value} </p>
              </div>
            ))
          }
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900"> Your applications </h2>
              <p className="mt-2 text-slate-500"> A quick view of your current job pipeline. </p>
            </div>
            <div className="relative w-full sm:w-80">
              <input value={search} onChange={(e) => setsearch(e.target.value)}
                placeholder="Search applications" className="w-full rounded-2xl border border-slate-200
                bg-slate-50 py-3 pl-4 pr-12 text-sm text-slate-900 outline-none focus:border-blue-500 
                focus:ring-2 focus:ring-blue-100" />

              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={18} />
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            {
              filteredApplications.map((application) => (
                <div key={application.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5
                shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900"> {application.title} </p>
                      <p className="mt-1 text-sm text-slate-500"> {application.company} </p>
                      <p className="mt-2 text-sm text-slate-500">Submitted {application.submitted} </p>
                      <p className="mt-2 text-lg font-bold text-slate-900">Score: {application.score}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold 
                      ${application.status === 'Offer'
                          ? 'bg-green-100 text-green-700'
                          : application.status === 'Interview Scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {application.status}
                      </span>

                      <div className='flex flex-col gap-4'>
                        <button onClick={() => openAiModal(application)} className='rounded-3xl bg-blue-800 
                          px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer'>
                          AI Insight
                        </button>

                        <button onClick={() => openScheduleModal(application)} className='rounded-3xl
                         bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500
                          cursor-pointer'>
                          Interview Scheduled
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-8">
          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900"> Profile summary </h3>
            <p className="mt-3 text-slate-600">Improve your visibility and discover more recruiter matches
              based on your skills and experience.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500"> Skills matched </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">14</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500"> Companies viewing </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">6</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900"> Recommended next steps </h3>
            <ul className="mt-6 space-y-4 text-slate-600">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 text-green-600" />
                <span> Update your resume with the latest certification details. </span>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 text-green-600" />
                <span> Upload a portfolio or work samples for designers and engineers. </span>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 text-green-600" />
                <span> Create a custom cover letter for your top application. </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {
        aiModal && selectedCandidate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-xl rounded-3xl p-6 relative">

              <button onClick={closeAiModal} className="absolute top-3 right-3">
                <X className='cursor-pointer hover:bg-blue-600 hover:text-white rounded-2xl
                transition-all duration-200' />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <Brain className="text-blue-600" />
                <div>
                  <h2 className="text-xl font-bold">AI Analysis</h2>
                  <p className="text-gray-500">{selectedCandidate.title}</p>
                </div>
              </div>

              <div className="bg-blue-200 p-4 rounded-xl mb-4">
                <p className="font-bold text-lg">Match Score: {selectedCandidate.score} </p>
              </div>

              <div>
                <p className="font-semibold">Strengths:</p>
                <ul className="list-disc ml-5 text-gray-600">
                  <li> Strong technical background </li>
                  <li> Good project experience </li>
                  <li> Relevant skills match </li>
                </ul>
              </div>

            </div>
          </div>
        )
      }

      {
        scheduleModal && selectedCandidate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 relative">

              <button onClick={closeScheduleModal} className="absolute top-3 right-3">
                <X className='hover:bg-blue-500 rounded-2xl hover:text-white cursor-pointer' />
              </button>

              <h2 className="text-xl font-bold mb-4"> Schedule Interview: {selectedCandidate.title} </h2>

              <form onSubmit={handleScheduleSubmit} className="space-y-8">
                <input type="date" name="date" value={formData.date} onChange={handleFormChange}
                  className="w-full border p-2 rounded" />

                <input type="time" name="time" value={formData.time} onChange={handleFormChange}
                  className="w-full border p-2 rounded"
                />

                <input type="interviewer" name="interviewer" value={formData.interviewer}
                  onChange={handleFormChange} className="w-full border p-2 rounded"
                />

                <input type="location" name="location" value={formData.location} onChange={handleFormChange}
                  className="w-full border p-2 rounded"
                />

                <button className="w-full bg-green-600 text-white py-2 rounded-lg cursor-pointer">
                  Schedule
                </button>
              </form>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default CandidateDashboard;