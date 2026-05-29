import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock } from 'react-icons/fa';

const Signup = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('candidate');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, set_Confirm_Password] = useState('');

  const isValid_Role = (value) => ['candidate', 'recruiter', 'admin'].includes(value);
  const isValid_Email = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const Handle_Submit = (e) => {
    e.preventDefault();
    if (!isValid_Role(role)) {
      alert('Error! Please select a valid role....');
      return;
    }

    if (!fullName.trim()) {
      alert('Error! Please enter your full name.');
      return;
    }

    if (!email || !isValid_Email(email)) {
      alert('Error! Please enter a valid email address.');
      return;
    }

    if (!password) {
      alert('Please create a password.');
      return;
    }

    if (password.length < 6) {
      alert('Error! Password field must have atleast 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    const key = `recruiterAI_user_${email.toLowerCase()}`;
    if (localStorage.getItem(key)) {
      alert('An account with this email already exists. Please log in or use a different email.');
      return;
    }

    const newUser = {
      role,
      fullName,
      email: email.toLowerCase(),
      password,
    };

    localStorage.setItem(key, JSON.stringify(newUser));
    alert('Signup successful! Please log in with your new credentials.');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-300 to-violet-500 px-4 py-10">
      <div className="w-full max-w-lg rounded-4xl bg-white p-10 shadow-2xl mt-20">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg">
            <FaUser size={24} />
          </div>
        </div>
        <h2 className="text-center text-3xl font-bold text-slate-900 underline"> Create Your Account </h2>
        <p className="mt-3 text-center text-slate-600"> Start your recruitment journey with Recruiter-AI </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-700"> Select the role </label>
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
                <input type="checkbox" name="role" value="admin" checked={role === "admin"}
                  onChange={(e) => setRole(e.target.value)} className="h-4 w-4 accent-blue-600" />
                Admin
              </label>
            </div>
          </div>

          <form className="space-y-4" onSubmit={Handle_Submit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Full Name </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
                <FaUser className="text-blue-600" />
                <input type="text" placeholder="Enter your full name" className="w-full bg-transparent text-slate-900 outline-none" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Email Address </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
                <FaEnvelope className="text-blue-600" />
                <input type="email" placeholder="Enter your email address" className="w-full bg-transparent text-slate-900 outline-none" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Password </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
                <FaLock className="text-blue-600" />
                <input type="password" placeholder="Create a password" className="w-full bg-transparent text-slate-900 outline-none" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700"> Confirm Password </label>
              <div className="flex items-center gap-3 rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 focus-within:border-blue-500">
                <FaLock className="text-blue-600" />
                <input type="password" placeholder="Confirm your password" className="w-full bg-transparent text-slate-900 outline-none" required value={confirmPassword} onChange={(e) => set_Confirm_Password(e.target.value)} />
              </div>
            </div>
            
            <button className="w-50 lg:ml-30 ml-10 mt-4 rounded-3xl bg-gradient-to-r cursor-pointer from-blue-600 to-violet-600 py-3 text-white text-sm font-semibold shadow-lg transition hover:opacity-95">
              Create Account
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-md text-slate-600"> Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:underline active:text-red-500">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;