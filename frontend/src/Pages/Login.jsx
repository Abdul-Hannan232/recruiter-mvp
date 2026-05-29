import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaLock, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isValid_Role = (value) => ['candidate', 'recruiter', 'admin'].includes(value);
  const isValid_Email = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const Handle_Login_Submit = (e) => {
    e.preventDefault();
    if (!isValid_Role(role)) {
      alert('Error! Please select a valid role.');
      return;
    }

    if (!email || !isValid_Email(email)) {
      alert('Error! Please enter a valid email address.');
      return;
    }

    if (!password) {
      alert('Please enter your password.');
      return;
    }

    const stored_User = localStorage.getItem(`recruiterAI_user_${email.toLowerCase()}`);
    if (!stored_User) {
      alert('Wrong email or password.');
      return;
    }

    const user = JSON.parse(stored_User);
    if (user.password !== password) {
      alert('Wrong email or password.');
      return;
    }

    if (user.role !== role) {
      alert('Selected role does not match your account. Please select the correct role.');
      return;
    }

    login(role);
    const path = role === 'recruiter' ? '/recruiter-dashboard' :
      role === 'candidate' ? '/candidate-dashboard' : '/admin-dashboard';
    navigate(path);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br
     from-blue-300 to-violet-500 px-4 py-10">
      <div className="w-full max-w-lg rounded-4xl bg-white p-10 shadow-2xl mt-20">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white 
            shadow-lg">
            <FaLock size={24} />
          </div>
        </div>
        <h2 className="text-center text-3xl font-bold text-slate-900 underline"> Welcome Back </h2>
        <p className="mt-3 text-center text-slate-600"> Log in to your Recruiter-AI account. </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-700"> Select the Role </label>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-slate-50
               px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-500">
                <input type="checkbox" name="role" value="candidate" checked={role === 'candidate'}
                  onChange={(e) => setRole(e.target.value)} className="h-4 w-4 accent-blue-600" />
                Candidate
              </label>

              <label className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-slate-50
                px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-500">
                <input type="checkbox" name="role" value="recruiter" checked={role === 'recruiter'}
                  onChange={(e) => setRole(e.target.value)} className="h-4 w-4 accent-blue-600" />
                Recruiter
              </label>

              <label className="inline-flex items-center gap-2 rounded-3xl border border-slate-300 bg-slate-50
               px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-500">
                <input type="checkbox" name="role" value="admin" checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value)} className="h-4 w-4 accent-blue-600" />
                Admin
              </label>
            </div>
          </div>
          
          <form className="space-y-6" onSubmit={Handle_Login_Submit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Email </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 
                py-3 focus-within:border-blue-500">
                <FaEnvelope className="text-blue-600" />
                <input type="email" placeholder="Enter your email address..." className="w-full bg-transparent
                 text-slate-900 outline-none" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Password </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
                <FaLock className="text-blue-600" />
                <input type="password" placeholder="Enter your password..." className="w-full bg-transparent
                 text-slate-900 outline-none" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <button className="w-50 lg:ml-30 ml-10 mt-4 rounded-3xl cursor-pointer bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-white text-sm font-semibold shadow-lg transition hover:opacity-95">
              Log In
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-md text-slate-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-blue-600 hover:underline active:text-red-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;