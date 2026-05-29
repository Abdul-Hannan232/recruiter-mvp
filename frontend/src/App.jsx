import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import RecruiterDashboard from "./Pages/RecruiterDashboard.jsx";

// No-auth phase: the default route renders the recruiter dashboard directly.
// Login/Signup/AuthContext are staged on disk but intentionally not wired here.
export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<RecruiterDashboard />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
