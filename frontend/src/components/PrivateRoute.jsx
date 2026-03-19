import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = (user?.role?.role_name || user?.role || '').toLowerCase();
    const allowed = allowedRoles.map((item) => String(item).toLowerCase());
    if (!allowed.includes(role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
