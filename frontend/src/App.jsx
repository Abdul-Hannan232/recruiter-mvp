import { Link, Route, Routes } from "react-router-dom";
import RecruiterDashboard from "./components/RecruiterDashboard.jsx";
import CandidateUpload from "./components/CandidateUpload.jsx";
import InterviewRoom from "./components/InterviewRoom.jsx";

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold">Agentic Recruitment</h1>
        <nav className="flex gap-4 text-sm text-slate-300">
          <Link to="/">Dashboard</Link>
          <Link to="/apply">Apply</Link>
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<RecruiterDashboard />} />
          <Route path="/apply" element={<CandidateUpload />} />
          <Route path="/interview/:candidateId" element={<InterviewRoom />} />
        </Routes>
      </main>
    </div>
  );
}
