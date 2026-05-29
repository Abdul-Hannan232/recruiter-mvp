import React, { createContext, useContext, useEffect, useState } from 'react';
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, set_Is_Authenticated] = useState(false);
  const [userRole, set_UserRole] = useState(null);

  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuth') === 'true';
    const storedRole = localStorage.getItem('userRole');
    set_Is_Authenticated(storedAuth && Boolean(storedRole));
    set_UserRole(storedRole || null);
  }, []);

  const login = (role) => {
    localStorage.setItem('isAuth', 'true');
    localStorage.setItem('userRole', role);
    set_Is_Authenticated(true);
    set_UserRole(role);
  };

  const logout = () => {
    localStorage.removeItem('isAuth');
    localStorage.removeItem('userRole');
    set_Is_Authenticated(false);
    set_UserRole(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};