import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardRouter = () => {
  const { isAuthenticated, userRole } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (userRole === 'recruiter') {
    return <Navigate to="/recruiter-dashboard" replace />;
  }

  if (userRole === 'candidate') {
    return <Navigate to="/candidate-dashboard" replace />;
  }

  if (userRole === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};
export default DashboardRouter;