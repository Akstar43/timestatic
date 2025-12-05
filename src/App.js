// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/login";
import Admin from "./pages/admin";
import UserDashboard from "./pages/UserDashboard";
import Profile from "./pages/Profile";
import SetupAdmin from "./pages/SetupAdmin";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Setup Admin - First Time Setup */}
          <Route path="/setup-admin" element={<SetupAdmin />} />

          <Route path="/login" element={<Login />} />

          {/* Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* User Dashboard */}
          <Route
            path="/user-dashboard"
            element={
              <ProtectedRoute requiredRole="user">
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Profile Page */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute requiredRole="user">
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Redirect root to login */}
          <Route path="/" element={<Login />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
