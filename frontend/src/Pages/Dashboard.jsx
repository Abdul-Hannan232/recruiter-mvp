import React, { useState } from 'react';
import { Users, Calendar, Briefcase, TrendingUp, Search, X, Funnel, Brain, Check } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Dashboard = () => {
  const [searchTerm, set_SearchTerm] = useState("");
  const [filter, set_Filter] = useState("All");
  const [showModal, set_ShowModal] = useState(false);
  const [selected_Candidate, set_selected_Candidate] = useState(null);
  const [Ai_Modal, set_Ai_Modal] = useState(false);
  const [formData, set_FormData] = useState({
    date: '', time: '', interviewer: '', location: ''
  });

  const stats = [
    { title: "Total Candidates", value: 13, icon: <Users size={22} />, bg: "bg-blue-100", color: "text-blue-600" },
    { title: "Interviews", value: 5, icon: <Calendar size={22} />, bg: "bg-green-100", color: "text-green-600" },
    { title: "Active Jobs", value: 8, icon: <Briefcase size={22} />, bg: "bg-purple-100", color: "text-purple-600" },
    { title: "Avg Match Score", value: "89%", icon: <TrendingUp size={22} />, bg: "bg-orange-100", color: "text-orange-600" },
  ];

  const Candidates_Data = [
    { name: "Ahmed Khan", role: "Frontend Developer", score: 92, status: "Interview Scheduled", skills: ["React Js", "TypeScript", "HTML", "CSS", "REST APIs"] },
    { name: "Ahsan Ali", role: "Backend Developer", score: 88, status: "Under Review", skills: ["Node.js", "Python", "SQL", "Microservices", "REST APIs"] },
    { name: "Omar Siddiqui", role: "Full Stack Developer", score: 90, status: "New", skills: ["Node.js", "React", "MongoDB", "PostgreSQL", "CI/CD"] },
    { name: "Ayesha Malik", role: "DevOps Engineer", score: 87, status: "Interview Scheduled", skills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"] },
    { name: "Hassan Javed", role: "Data Scientist", score: 93, status: "Under Review", skills: ["Python", "Machine Learning", "SQL", "AI", "Statistics"] },
    { name: "Abdur Rahman", role: "Cybersecurity Analyst", score: 89, status: "New", skills: ["Network Security", "SIEM tools", "Penetration Testing", "Incident Response"] },
    { name: "Yusuf Ahmed", role: "Cloud Engineer", score: 91, status: "Interview Scheduled", skills: ["AWS", "Azure", "GCP", "Docker", "Kubernetes"] },
    { name: "Maryam Noor", role: "AI / ML Engineer", score: 94, status: "New", skills: ["Python", "TensorFlow", "PyTorch", "Deep Learning", "Model Deployment"] },
    { name: "Imran Qureshi", role: "Mobile App Developer", score: 86, status: "Under Review", skills: ["Flutter", "React Native", "Swift", "Kotlin", "REST APIs"] },
    { name: "Sara Khan", role: "Software QA Engineer", score: 88, status: "Interview Scheduled", skills: ["Selenium", "Cypress", "Test Automation", "CI/CD", "Bug Tracking"] },
    { name: "Ali Raza", role: "Database Administrator (DBA)", score: 90, status: "Under Review", skills: ["MySQL", "PostgreSQL", "Oracle", "Backup & Recovery", "Performance Tuning"] },
    { name: "Ahmed Farooq", role: "IT Support Engineer", score: 85, status: "New", skills: ["Networking", "Windows/Linux", "Troubleshooting", "Helpdesk", "Customer Support"] },
    { name: "Bilal Aslam", role: "Security Engineer", score: 92, status: "Interview Scheduled", skills: ["Firewall/VPN", "Cloud Security", "Vulnerability Management", "Python/Bash", "SIEM"] },
  ];

  const filtered_Candidates = Candidates_Data.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.skills.some((skill) => skill.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filter === "All" || c.status === filter;
    return matchesSearch && matchesStatus;
  });

  const openModal = (candidate) => {
    set_selected_Candidate(candidate);
    set_ShowModal(true);
  };

  const closeModal = () => {
    set_ShowModal(false);
    set_FormData({ date: '', time: '', interviewer: '', location: '' });
  };

  const open_Ai_Model = (candidate) => {
    set_selected_Candidate(candidate);
    set_Ai_Modal(true);
  };

  const close_Ai_Model = () => {
    set_Ai_Modal(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success(`Congrats, Interview scheduled for ${selected_Candidate.name}!`);
    closeModal();
  };

  return (
    <div className='min-h-screen bg-gray-300 p-6 md:p-8'>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className='max-w-7xl mx-auto mt-15'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-5'>
          {
            stats.map((s, index) => (
              <div key={index} className='bg-white rounded-3xl shadow-sm p-5 flex justify-between items-center
                cursor-pointer hover:shadow-2xl'>
                <div>
                  <p className='text-black text-2xl font-bold underline'> {s.title} </p>
                  <h2 className="text-xl font-semibold text-black mt-1"> {s.value} </h2>
                </div>
                <div className={`p-3 rounded-lg ${s.bg} ${s.color}`}> {s.icon} </div>
              </div>
            ))
          }
        </div>

        <div className='flex flex-col md:flex-row gap-5 mt-6'>
          <div className='relative flex-1'>
            <Search size={18} className='absolute top-3 left-3 text-gray-500' />
            <input type="text" placeholder="Search candidates by name, position, or skills..."
              className='w-full border border-gray-500 rounded-lg pl-10 pr-4 py-2 focus:outline-none 
              focus:ring-2 focus:ring-blue-500 focus:border-none'
              value={searchTerm} onChange={(e) => set_SearchTerm(e.target.value)} />
          </div>
          <Funnel size={20} className='text-gray-700 absolute right-10 mt-3' />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {
            filtered_Candidates.length > 0 ? filtered_Candidates.map((c, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm cursor-pointer hover:shadow-2xl p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800 text-[22px]"> {c.name} </h3>
                    <p className="text-sm font-semibold text-gray-500"> {c.role} </p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-blue-200 font-bold text-blue-600">
                    {c.status} </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between font-semibold text-sm mb-1">
                    <span> Match Score  </span>
                    <span> {c.score}% </span>
                  </div>
                  <div className="w-full bg-gray-300 h-2 rounded-full">
                    <div className="bg-gradient-to-r from-blue-700 to-purple-900 h-2 rounded-full"
                      style={{ width: `${c.score}%` }}>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="font-semibold text-md text-gray-900 underline"> Skills: </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {
                      c.skills.map((skill, index) => (
                        <span key={index} className="bg-blue-400 text-white font-bold text-xs px-3 py-1 
                          rounded-full"> {skill} </span>
                      ))
                    }
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button onClick={() => openModal(c)} className="flex-1 bg-blue-600 text-white py-2 
                    rounded-lg hover:bg-blue-700 cursor-pointer text-sm text-center"> Schedule Interview </button>
                  <button onClick={() => open_Ai_Model(c)} className="flex-1 border border-blue-600
                   text-blue-600 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition text-sm
                    text-center cursor-pointer">
                    AI Analysis </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center text-xl font-bold underline text-red-600
                ">
                Error! No candidates are found.
              </div>
            )
          }
        </div>

        {
          showModal && selected_Candidate && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
                <button onClick={closeModal} className="absolute cursor-pointer top-3 right-3 text-gray-500">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-bold mb-4 text-center">Schedule Interview for {selected_Candidate.name} </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block font-semibold mb-1"> Date </label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2" required
                      value={formData.date} onChange={(e) => set_FormData({ ...formData, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1"> Time </label>
                    <input type="time" className="w-full border rounded-lg px-3 py-2" required
                      value={formData.time} onChange={(e) => set_FormData({ ...formData, time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1"> Interviewer </label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2" required
                      value={formData.interviewer} onChange={(e) => set_FormData({ ...formData, interviewer: e.target.value })} />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1"> Location </label>
                    <input type="text" className="w-full border rounded-lg px-3 py-2" required
                      value={formData.location} onChange={(e) => set_FormData({ ...formData, location: e.target.value })} />
                  </div>
                  <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">
                    Schedule
                  </button>
                </form>
              </div>
            </div>
          )
        }

        {
          Ai_Modal && selected_Candidate && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50
              overflow-y-auto">

              <div className="bg-white w-full max-w-2xl rounded-2xl p-8 mt-40 relative shadow-xl">
                <button onClick={close_Ai_Model} className="absolute top-4 right-4 text-gray-500
                 hover:text-gray-800 cursor-pointer">
                  <X size={22} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-700 text-white p-3 rounded-full">
                    <Brain />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold underline"> AI Analysis </h2>
                    <p className="text-gray-500"> {selected_Candidate.name} </p>
                  </div>
                </div>

                <div className="bg-gray-100 rounded-xl p-6 mb-6">
                  <h3 className="font-semibold mb-3"> Overall Match Score </h3>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-bold text-blue-600">
                      {selected_Candidate.score}%
                    </span>
                    <div className="flex-1 bg-gray-300 h-3 rounded-full">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full"
                        style={{ width: `${selected_Candidate.score}%` }} >
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold mb-3"> Key Strengths </h3>
                  <ul className="space-y-2 text-gray-700">
                    {
                      selected_Candidate.skills.slice(0, 4).map((skill, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-600 font-bold"> <Check /> </span>
                          Strong expertise in {skill}
                        </li>
                      ))
                    }
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Development Areas</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500 font-bold">•</span>
                      Could benefit from additional enterprise-level experience
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500 font-bold">•</span>
                      Limited exposure to large-scale distributed systems
                    </li>
                  </ul>
                </div>

                <div className="bg-green-100 border border-green-300 rounded-xl p-5">
                  <h3 className="font-semibold mb-1">Recommendation</h3>
                  <p className="text-green-700 font-semibold">
                    Highly Recommended
                  </p>
                </div>
              </div>
            </div>
          )
        }
      </div>
    </div>
  )
}

export default Dashboard;