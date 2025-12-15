// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import Login from "./pages/login";
import SignupCompany from "./pages/SignupCompany";
import Admin from "./pages/AdminPage";
import UserDashboard from "./pages/UserDashboard";
import Profile from "./pages/Profile";
import SetupAdmin from "./pages/SetupAdmin";
import TestIsolation from "./pages/TestIsolation"; // New Test Page
import JoinOrganization from "./pages/JoinOrganization"; // Invite Acceptance Page
import ResetData from "./pages/ResetData"; // Utils
import ProtectedRoute from "./components/ProtectedRoute";

import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getToken } from "firebase/messaging";
import { auth, db, messaging } from "./firebase/firebase";
import toast, { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext";



function App() {
  const [user, setUser] = useState(null);

  // Request Permission on Load (for Desktop/Android ONLY - iOS requires user gesture)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Detect iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (!isIOS) {
          // Safe to auto-request on Desktop/Android
          import("./services/notificationService").then(({ requestAndSaveNotificationPermission }) => {
            requestAndSaveNotificationPermission(currentUser.uid);
          });
        } else {
          console.log("iOS detected - skipping auto-request. User must enable via Profile button.");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for Foreground Notifications
  useEffect(() => {
    import("firebase/messaging").then(({ onMessage }) => {
      onMessage(messaging, (payload) => {
        console.log("Foreground Message received:", payload);
        const { title, body } = payload.notification;

        toast((t) => (
          <div onClick={() => toast.dismiss(t.id)} className="cursor-pointer">
            <p className="font-bold">{title}</p>
            <p className="text-sm">{body}</p>
          </div>
        ), { duration: 5000, position: 'top-right' });
      });
    });
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <OrganizationProvider>
          <Router>
            <Toaster />
            <Routes>
              {/* Setup Admin - First Time Setup */}
              <Route path="/setup-admin" element={<SetupAdmin />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignupCompany />} />
              <Route path="/join" element={<JoinOrganization />} />
              {/* <Route path="/reset-data" element={<ResetData />} /> */}

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
              <Route path="/test-isolation" element={<ProtectedRoute><TestIsolation /></ProtectedRoute>} />
              <Route path="/" element={<Login />} />
            </Routes>
          </Router>
        </OrganizationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
