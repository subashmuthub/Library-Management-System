import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts';

const PrivateRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0) {
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.role_name;
    const allowed = roles.map((r) => r.toLowerCase());
    if (!allowed.includes((roleName || '').toLowerCase())) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
