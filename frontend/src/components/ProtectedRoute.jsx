import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, userRole, loading } = useAuth();

  // Wait for the persisted Supabase session to hydrate before deciding — otherwise
  // a logged-in recruiter would briefly be bounced to /login on a hard refresh.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // userRole is read from Supabase user_metadata (set at signup), NOT from a backend
  // profile — so a brand-new candidate with no Candidate row yet still passes their
  // own route guard (the RBAC chicken-and-egg trap only bites server-side calls).
  if (requiredRole && userRole && userRole !== requiredRole) {
    // Send mismatched users to THEIR home rather than bouncing to /login.
    const home = userRole === "candidate" ? "/candidate" : "/";
    return <Navigate to={home} replace />;
  }

  return children;
};

export default ProtectedRoute;
