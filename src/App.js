// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/login";
import Admin from "./pages/AdminPage";
import UserDashboard from "./pages/UserDashboard";
import Profile from "./pages/Profile";
import SetupAdmin from "./pages/SetupAdmin";
import ProtectedRoute from "./components/ProtectedRoute";

import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getToken } from "firebase/messaging";
import { auth, db, messaging } from "./firebase/firebase";
import toast, { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext";



function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Request Notification Permission & Get Token
  const requestNotificationPermission = async (uid) => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Retrieve the FCM token.
        // Note: For production use with widely varying browsers, ensuring a VAPID key is configured in the manifest 
        // or passed here is recommended, but basic standard implementation often works with default configs.
        const currentToken = await getToken(messaging);

        if (currentToken) {
          console.log('FCM Token Generated:', currentToken);
          // Save token to user profile in Firestore
          const q = query(collection(db, "users"), where("uid", "==", uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docId = querySnapshot.docs[0].id;
            await updateDoc(doc(db, "users", docId), {
              fcmToken: currentToken,
              fcmTokenUpdatedAt: new Date() // Useful for tracking token freshness
            });
            console.log('FCM Token saved to user profile');
          } else {
            console.warn('User profile not found for storing FCM token');
          }
        }
      } else {
        console.log('Notification permission denied');
      }
    } catch (error) {
      console.error('Error getting notification token:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Attempt to get notification permission when user is logged in
        requestNotificationPermission(currentUser.uid);
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
        <Router>
          <Toaster />
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
    </ThemeProvider>
  );
}

export default App;
