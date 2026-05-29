import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FaUser, FaBars, FaTimes } from 'react-icons/fa';
// import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  // TEMP (no-auth phase): mock the auth hook so the Navbar renders without an
  // <AuthProvider> wrapper. Restore `const { isAuthenticated, userRole, logout } = useAuth();`
  // when the auth flow is wired up.
  const isAuthenticated = true;
  const userRole = 'recruiter';
  const logout = () => {};

  const Handle_Logout = () => {
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full bg-white shadow-md px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <FaUser className="rounded-full bg-blue-600 p-2 text-white" />
          <div>
            <p className="font-bold text-lg text-slate-900">Recruiter <span className="text-blue-600">AI</span></p>
            <p className="text-xs text-slate-500">Role: {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Guest'}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {isAuthenticated && (
            <>
              <Link to="/">Home</Link>
              <Link to="/jobs">Jobs</Link>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/applications">Applications</Link>
            </>
          )}

          {isAuthenticated ? (
            <button onClick={Handle_Logout} className="rounded-3xl bg-red-500 px-4 py-2 text-white font-semibold hover:bg-red-600">
              Logout
            </button>
          ) : (
            <>
              <NavLink to="/login" className="rounded-3xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700">
                Login
              </NavLink>
              <NavLink to="/signup" className="rounded-3xl bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700">
                Signup
              </NavLink>
            </>
          )}
        </div>

        <button className="md:hidden text-2xl text-slate-700" onClick={() => setIsOpen(true)}>
          <FaBars />
        </button>
      </nav>

      {isOpen && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsOpen(false)} />}

      <div className={`fixed top-0 left-0 z-50 h-full w-full bg-white p-6 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="font-bold text-lg text-slate-900">Recruiter <span className="text-blue-600">AI</span></p>
          </div>
          <button onClick={() => setIsOpen(false)}>
            <FaTimes className="text-2xl text-slate-700" />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-slate-800 text-base">
          {isAuthenticated && (
            <>
              <Link to="/" onClick={() => setIsOpen(false)}>Home</Link>
              <Link to="/jobs" onClick={() => setIsOpen(false)}>Jobs</Link>
              <Link to="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</Link>
              <Link to="/applications" onClick={() => setIsOpen(false)}>Applications</Link>
            </>
          )}
          {isAuthenticated ? (
            <button onClick={Handle_Logout} className="rounded-3xl bg-red-500 px-4 py-3 text-white font-semibold">
              Logout
            </button>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setIsOpen(false)} className="rounded-3xl bg-blue-600 px-4 py-3
               text-white font-semibold text-center">
                Login
              </NavLink>
              <NavLink to="/signup" onClick={() => setIsOpen(false)} className="rounded-3xl bg-blue-600 px-4 py-3
               text-white font-semibold text-center">
                Signup
              </NavLink>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;