// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db, googleProvider } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";
import { getAuth } from "firebase/auth";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("user"); // toggle between 'user' and 'admin'
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      setError("");
      const auth = getAuth();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore by email (not UID)
      const q = query(collection(db, "users"), where("email", "==", user.email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // User not registered by admin - deny access
        setError("Access denied: Your email is not registered. Please contact your administrator.");
        setIsLoading(false);
        return;
      }

      // Get the user document
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // Update the user document with Google UID and photo if not already set
      if (!userData.uid || userData.uid !== user.uid) {
        await updateDoc(doc(db, "users", userDoc.id), {
          uid: user.uid,
          photoURL: user.photoURL || userData.photoURL || "",
          name: userData.name || user.displayName || user.email.split('@')[0]
        });
      }

      const userRole = userData.role || "user";

      // Navigate based on role
      if (role === "admin") {
        if (userRole !== "admin") {
          setError("Access denied: You don't have admin privileges");
          setIsLoading(false);
          return;
        }
        navigate("/admin");
      } else {
        if (userRole !== "user") {
          setError("Access denied: Please use the admin portal");
          setIsLoading(false);
          return;
        }
        navigate("/user-dashboard");
      }
    } catch (e) {
      console.error(e);
      setError("Google sign-in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg p-4 transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in transition-colors duration-200">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-heading font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 dark:text-red-100 px-4 py-3 rounded-xl mb-6 text-sm text-center animate-pulse-slow">
            {error}
          </div>
        )}

        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl mb-8">
          <button
            onClick={() => setRole("user")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${role === "user"
              ? "bg-white dark:bg-primary-600 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
              }`}
          >
            User Portal
          </button>
          <button
            onClick={() => setRole("admin")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${role === "admin"
              ? "bg-white dark:bg-primary-600 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
              }`}
          >
            Admin Portal
          </button>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 py-3.5 rounded-xl font-semibold shadow-sm hover:shadow-md transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
