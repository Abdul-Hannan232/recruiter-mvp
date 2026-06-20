import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaUser, FaBars, FaTimes } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, userRole, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    setIsOpen(false);
    navigate("/login");
  };

  // Auth-aware nav links — mirrors the live route map (Phase 9 calibration).
  const links = !isAuthenticated
    ? [
        { to: "/", label: "Home" },
      ]
    : userRole === "candidate"
      ? [
          { to: "/", label: "Home" },
          { to: "/candidate", label: "Portal" },
          { to: "/profile", label: "Profile" },
        ]
      : [
          { to: "/", label: "Home" },
          { to: "/dashboard", label: "Dashboard" },
          { to: "/settings", label: "Settings" },
        ];

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive ? "text-indigo-600" : "text-slate-600 hover:text-indigo-600"
    }`;

  const roleLabel = isAuthenticated
    ? `Role: ${userRole ? userRole[0].toUpperCase() + userRole.slice(1) : "Member"}`
    : "AI-Powered Hiring";

  return (
    <>
      <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <FaUser />
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold text-slate-900">
              Recruiter <span className="text-indigo-600">AI</span>
            </p>
            <p className="text-[11px] text-slate-400">{roleLabel}</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Logout
            </button>
          ) : (
            <>
              <NavLink
                to="/login"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Sign up
              </NavLink>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="text-xl text-slate-700 md:hidden"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <FaBars />
        </button>
      </nav>

      {/* Mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-72 bg-white p-6 shadow-2xl transition-transform duration-300 md:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
          <p className="text-base font-bold text-slate-900">
            Recruiter <span className="text-indigo-600">AI</span>
          </p>
          <button onClick={() => setIsOpen(false)} aria-label="Close menu">
            <FaTimes className="text-xl text-slate-700" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-3 py-2 text-base font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Logout
              </button>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
