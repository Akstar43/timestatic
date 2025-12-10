// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, "users"), where("uid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setUserRole(userData.role || "user");
        } else {
          setUserRole("user"); // Default to user if not found
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("user");
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();
  }, [currentUser]);

  if (!currentUser) {
    // Not logged in
    return <Navigate to="/login" />;
  }

  if (loading) {
    // Show loading state while fetching user role
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Check role if provided
  if (requiredRole) {
    if (requiredRole === "admin" && userRole !== "admin") {
      return <Navigate to="/user-dashboard" />;
    }
    // Note: Admins are allowed to access user routes (requiredRole="user")
  }

  return children;
}
