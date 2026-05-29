import React, { useState } from "react";

const Candidates_Data = [
  {
    name: "Ahmed Khan",
    role: "Frontend Developer",
    score: 92,
    status: "Interview Scheduled",
    applied_Date: "16/01/2024",
    interview: { date: "26/01/2024", time: "11:30 AM", type: "In-Person" }
  },
  {
    name: "Ahsan Ali",
    role: "Backend Developer",
    score: 88,
    status: "Under Review",
    applied_Date: "20/01/2024",
    interview: { date: "2/02/2024", time: "2:00 PM", type: "Video-Call" }
  },
  {
    name: "Omar Siddiqui",
    role: "Full Stack Developer",
    score: 90,
    status: "New",
    applied_Date: "25/01/2024",
    interview: { date: "15/02/2024", time: "1:00 PM", type: "In-Person" }
  },
  {
    name: "Ayesha Malik",
    role: "DevOps Engineer",
    score: 87,
    status: "Interview Scheduled",
    applied_Date: "5/02/2024",
    interview: { date: "20/03/2024", time: "11:00 AM", type: "Voice-Call" }
  },
  {

    name: "Hassan Javed",
    role: "Data Scientist",
    score: 93,
    status: "Under Review",
    applied_Date: "20/03/2024",
    interview: { date: "3/04/2024", time: "4:00 PM", type: "Video-Call" }
  },
  {

    name: "Abdur Rahman",
    role: "Cybersecurity Analyst",
    score: 89,
    status: "New",
    applied_Date: "30/03/2024",
    interview: { date: "20/04/2024", time: "3:00 PM", type: "In-Person" }
  },
  {
    name: "Yusuf Ahmed",
    role: "Cloud Engineer",
    score: 91,
    status: "Interview Scheduled",
    applied_Date: "15/03/2024",
    interview: { date: "30/04/2024", time: "11:30 AM", type: "In-Person" }
  },
  {
    name: "Maryam Noor",
    role: "AI / ML Engineer",
    score: 94,
    status: "New",
    applied_Date: "20/04/2024",
    interview: { date: "10/05/2024", time: "3:00 PM", type: "Voice-Call" }
  },
  {
    name: "Imran Qureshi",
    role: "Mobile App Developer",
    score: 86,
    status: "Under Review",
    applied_Date: "10/05/2024",
    interview: { date: "26/05/2024", time: "1:00 AM", type: "Video-Call" }
  },
  {
    name: "Sara Khan",
    role: "Software QA Engineer",
    score: 88,
    status: "Interview Scheduled",
    applied_Date: "20/05/2024",
    interview: { date: "30/05/2024", time: "8:00 AM", type: "In-Person" }
  },
  {
    name: "Ali Raza",
    role: "Database Administrator (DBA)",
    score: 90,
    status: "Under Review",
    applied_Date: "30/05/2024",
    interview: { date: "5/06/2024", time: "11:30 AM", type: "Voice-Call" }
  },
  {
    name: "Ahmed Farooq",
    role: "IT Support Engineer",
    score: 85,
    status: "New",
    applied_Date: "24/05/2024",
    interview: { date: "3/06/2025", time: "11:00 AM", type: "Video-Call" }
  },
  {

    name: "Bilal Aslam",
    role: "Security Engineer",
    score: 92,
    status: "Interview Scheduled",
    applied_Date: "5/6/2024",
    interview: { date: "20/6/2024", time: "2:00 PM", type: "In-Person" }
  },
];

const Application = () => {
  const [filterStatus, setFilterStatus] = useState("All");

  const filtered =
    filterStatus === "All"
      ? Candidates_Data
      : Candidates_Data.filter((c) => c.status === filterStatus);

  const total = Candidates_Data.length;
  const newCount = Candidates_Data.filter(c => c.status === "New").length;
  const reviewCount = Candidates_Data.filter(c => c.status === "Under Review").length;
  const interviewCount = Candidates_Data.filter(c => c.status === "Interview Scheduled").length;

  const getStatusStyle = (status) => {
    switch (status) {
      case "Interview Scheduled":
        return "bg-green-100 text-green-700";
      case "Under Review":
        return "bg-yellow-100 text-yellow-700";
      case "New":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto mt-15">
        <h1 className="text-3xl font-bold"> Application Tracking </h1>
        <p className="text-gray-500 mt-1">
          Monitor and manage all candidate applications!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatCard title="Total Applications" value={total} />
          <StatCard title="New" value={newCount} />
          <StatCard title="Under Review" value={reviewCount} />
          <StatCard title="Interviews Scheduled" value={interviewCount} />
        </div>

        <div className="flex justify-between items-center mt-6 border-gray-800 outline-1 rounded-lg">
          <div>
            <label className="mr-2 ml-3 font-medium"> Filter by Status: </label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border-none outline px-3 py-1 rounded-lg ml-2">
              <option value="All"> All </option>
              <option value="New"> New </option>
              <option value="Under Review"> Under Review </option>
              <option value="Interview Scheduled"> Interview Scheduled </option>
              <option value="Rejected"> Rejected </option>
            </select>
          </div>

          <p className="text-sm text-gray-600 mr-3">
            Showing {filtered.length} of {total} applications
          </p>
        </div>

        <div className="sm:hidden space-y-4 mt-4">
          {filtered.map((c, index) => (
            <div key={index} className="bg-white rounded-xl shadow p-4 space-y-3">

              <div>
                <p className="font-bold text-lg"> {c.name} </p>
                <p className="text-gray-500 text-sm"> {c.role} </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-1"> Match Score </p>
                <div className="flex items-center gap-3">
                  <div className="w-full bg-gray-200 h-2 rounded-full">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-700 h-2 rounded-full"
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <span className="text-sm"> {c.score}% </span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="font-medium">  Status: </span>
                <span className={`px-3 py-1 text-xs rounded-full ${getStatusStyle(c.status)}`}>
                  {c.status}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="font-medium"> Applied: </span>
                <span>{c.applied_Date}</span>
              </div>

              <div className="text-sm">
                <p className="font-medium"> Interview: </p>
                {
                  c.interview ? (
                    <div className="text-gray-600">
                      <p> {c.interview.date} </p>
                      <p> {c.interview.time} </p>
                      <p> {c.interview.type} </p>
                    </div>
                  ) : (
                    <span className="text-gray-400"> Not Scheduled </span>
                  )
                }
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto bg-white rounded-xl shadow mt-4">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-800 font-bold uppercase text-md">
              <tr>
                <th className="px-6 py-3"> Candidate </th>
                <th className="px-6 py-3"> Position </th>
                <th className="px-6 py-3"> Match Score </th>
                <th className="px-6 py-3"> Status </th>
                <th className="px-6 py-3"> Applied Date </th>
                <th className="px-6 py-3"> Interview </th>
              </tr>
            </thead>

            <tbody>
              {
                filtered.map((c, index) => (
                  <tr key={index} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium"> {c.name} </td>
                    <td className="px-6 py-4"> {c.role} </td>

                    <td className="px-6 py-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-gray-200 h-2 rounded-full">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-purple-700 h-2 rounded-full"
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                        <span> {c.score}% </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-full md:text-sm ${getStatusStyle(c.status)}`}>
                        {c.status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {c.applied_Date}
                    </td>

                    <td className="px-6 py-4">
                      {
                        c.interview ? (
                          <div className="text-sm">
                            <p> {c.interview.date} </p>
                            <p> {c.interview.time} </p>
                            <p className="text-gray-500"> {c.interview.type} </p>
                          </div>
                        ) : (
                          <span className="text-gray-400"> Not Scheduled </span>
                        )
                      }
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>

          {
            filtered.length === 0 && (
              <div className="text-center font-bold py-6 text-xl text-red-500 sm:mt-5">
                Error! No applications of candidates are found....
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value }) => (
  <div className="bg-white rounded-xl p-5 shadow">
    <p className="text-black font-bold text-xl underline"> {title} </p>
    <h2 className="text-xl font-bold mt-2 text-gray-800"> {value} </h2>
  </div>
);

export default Application;