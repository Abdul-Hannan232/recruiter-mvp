import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import RecruiterDashboard from "./Pages/RecruiterDashboard.jsx";
import CandidatePortal from "./Pages/CandidatePortal.jsx";
import CandidateUpload from "./components/CandidateUpload.jsx";
import InterviewRoom from "./components/InterviewRoom.jsx";
import Login from "./Pages/Login.jsx";
import Signup from "./Pages/Signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Immersive, logo-only top bar for the live interview — no auth/nav distractions.
// Keeps ~the same height as the full Navbar so the InterviewRoom layout is unchanged.
function ImmersiveHeader() {
  return (
    <nav className="fixed top-0 left-0 z-50 flex w-full items-center bg-white px-6 py-4 shadow-md">
      <p className="text-lg font-bold text-slate-900">
        Recruiter <span className="text-blue-600">AI</span>
      </p>
    </nav>
  );
}

// Recruiter side is gated behind Supabase Auth; the candidate interview link stays
// public (frictionless — no candidate login, access is via the unique /interview link).
export default function App() {
  // On the interview route, swap the full Navbar (auth buttons + nav links) for a
  // stripped-down logo-only header so the live WebRTC call is distraction-free.
  const { pathname } = useLocation();
  const immersive = pathname.startsWith("/interview");

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {immersive ? <ImmersiveHeader /> : <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute requiredRole="recruiter">
                <RecruiterDashboard />
              </ProtectedRoute>
            }
          />
          {/* Zero-Click candidate portal: sign up -> upload resume -> global pool. */}
          <Route
            path="/candidate"
            element={
              <ProtectedRoute requiredRole="candidate">
                <CandidatePortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute requiredRole="recruiter">
                <CandidateUpload />
              </ProtectedRoute>
            }
          />
          {/* Phase 4 candidate entry via the emailed link: /interview?room=<UUID>.
              Public + frictionless — the room token is the candidate's credential. */}
          <Route path="/interview" element={<InterviewRoom />} />
          <Route path="/interview/:id" element={<InterviewRoom />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
