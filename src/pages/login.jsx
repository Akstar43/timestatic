// src/pages/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, addDoc, setDoc, doc, updateDoc } from "firebase/firestore";
import { db, googleProvider, ts } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";
import { getAuth } from "firebase/auth";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("user"); // toggle between 'user' and 'admin'
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      setError("");

      // Login via Firebase Authentication
      const userCredential = await login(email, password);
      const uid = userCredential.user.uid;

      // Fetch user data from Firestore to check role
      const q = query(collection(db, "users"), where("uid", "==", uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("User not found in database. Please contact your administrator.");
        setIsLoading(false);
        return;
      }

      const userData = snapshot.docs[0].data();
      const userRole = userData.role || "user";

      // Check if user's role matches the selected portal
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
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-heading font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-primary-100">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-xl mb-6 text-sm text-center animate-pulse-slow">
            {error}
          </div>
        )}

        <div className="flex bg-white/5 p-1 rounded-xl mb-8">
          <button
            onClick={() => setRole("user")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${role === "user"
              ? "bg-white text-primary-900 shadow-lg"
              : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
          >
            User Portal
          </button>
          <button
            onClick={() => setRole("admin")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${role === "admin"
              ? "bg-white text-primary-900 shadow-lg"
              : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
          >
            Admin Portal
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-100 ml-1">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all duration-200"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-primary-100 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-primary-500/30 transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-transparent text-white/50">Or continue with</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3.5 rounded-xl font-semibold shadow-lg transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
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
