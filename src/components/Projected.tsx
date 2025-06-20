import React from 'react';
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("token");
  
  if (!token) {
    // Redirect to login page if no token exists
    return <Navigate to="/" replace />;
  }
  
  // If token exists, render the child component (Dashboard)
  return children;
};

export default ProtectedRoute;