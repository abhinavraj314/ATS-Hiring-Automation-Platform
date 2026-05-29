import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import JobsPage from "./pages/Jobs";
import CandidatesPage from "./pages/Candidates";
import ShortlistedPage from "./pages/Shortlisted";
import SettingsPage from "./pages/Settings";
import PanelPage from "./pages/Panel";
import React from "react";

// Placeholder for protected routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route 
            path="/jobs" 
            element={
              <ProtectedRoute>
                <JobsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/candidates" 
            element={
              <ProtectedRoute>
                <CandidatesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/shortlisted" 
            element={
              <ProtectedRoute>
                <ShortlistedPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/panel" 
            element={
              <ProtectedRoute>
                <PanelPage />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/jobs" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
