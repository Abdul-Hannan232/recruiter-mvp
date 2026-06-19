import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import RecruiterDashboard from "./Pages/RecruiterDashboard.jsx";
import CandidatePortal from "./Pages/CandidatePortal.jsx";
import InterviewRoom from "./components/InterviewRoom.jsx";
import Login from "./Pages/Login.jsx";
import Signup from "./Pages/Signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Recruiter side is gated behind Supabase Auth; the candidate interview link stays
// public (frictionless — no candidate login, access is via the unique /interview link).
export default function App() {
  // The live interview is a standalone, full-screen booth: it renders NO site Navbar
  // or Footer and escapes the page wrapper entirely (it owns the whole viewport).
  const { pathname } = useLocation();
  const immersive = pathname.startsWith("/interview");

  if (immersive) {
    return (
      <Routes>
        {/* Phase 4 candidate entry via the emailed link: /interview?room=<UUID>.
            Public + frictionless — the room token is the candidate's credential. */}
        <Route path="/interview" element={<InterviewRoom />} />
        <Route path="/interview/:id" element={<InterviewRoom />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Navbar />
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
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
