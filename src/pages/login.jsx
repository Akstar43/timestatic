// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, googleProvider } from "../firebase/firebase";
import { signInWithPopup, signInAnonymously, getAuth } from "firebase/auth";
import { sendOTPEmail } from "../services/emailService";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get current auth state

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-Redirect if ALREADY logged in (Persistence Fix)
  React.useEffect(() => {
    if (currentUser) {
      // Fetch role to know where to send them
      const fetchRoleAndRedirect = async () => {
        try {
          const q = query(collection(db, "users"), where("uid", "==", currentUser.uid));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const userRole = userData.role || "user";
            navigate(userRole === "admin" ? "/admin" : "/user-dashboard", { replace: true });
          }
        } catch (e) {
          console.error("Auto-redirect check failed", e);
        }
      };
      fetchRoleAndRedirect();
    }
  }, [currentUser, navigate]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      setError("");
      const auth = getAuth();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore by email (not UID)
      const q = query(collection(db, "users"), where("email", "==", user.email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // SPECIAL CASE: Auto-create Master Admin if not exists
        if (user.email === "akmusajee53@gmail.com") {
          const newDocRef = doc(db, "users", user.uid); // Use Auth UID as doc ID
          await setDoc(newDocRef, {
            uid: user.uid,
            name: user.displayName || "Master Admin",
            email: user.email,
            role: "admin",
            orgId: "MASTER_ADMIN",
            organizationName: "System Administrator",
            photoURL: user.photoURL || "",
            createdAt: serverTimestamp(),
            leaveDaysAssigned: 100,
            workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]
          });

          // Proceed to admin
          navigate("/admin");
          setIsLoading(false);
          return;
        }

        // User not registered by admin - deny access
        setError("Access denied: Your email is not registered. Please contact your administrator.");
        setIsLoading(false);
        return;
      }

      // Get the user document
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // Always update Google photoURL and UID on login
      await updateDoc(doc(db, "users", userDoc.id), {
        uid: user.uid,
        photoURL: user.photoURL || userData.photoURL || "",
        name: userData.name || user.displayName || user.email.split('@')[0]
      });

      const userRole = userData.role || "user";
      navigate(userRole === "admin" ? "/admin" : "/user-dashboard");
    } catch (e) {
      console.error("Google Login Error:", e);
      let msg = "Google sign-in failed. Please try again.";
      if (e.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
      else if (e.code === 'auth/unauthorized-domain') msg = "Domain not authorized in Firebase Console.";
      else if (e.message) msg = e.message;

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("Access denied: Email not found.");
        setIsLoading(false);
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Save OTP to Firestore
      await updateDoc(doc(db, "users", userDoc.id), {
        loginOTP: generatedOTP,
        loginOTPExpires: expiry
      });

      // Send Email
      const emailResult = await sendOTPEmail(email, generatedOTP, userData.name);
      if (emailResult.success) {
        setShowOTPInput(true);
      } else {
        setError("Failed to send OTP email. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("User not found.");
        setIsLoading(false);
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      if (userData.loginOTP !== otp) {
        setError("Invalid OTP code.");
        setIsLoading(false);
        return;
      }

      if (Date.now() > userData.loginOTPExpires) {
        setError("OTP code has expired. Please request a new one.");
        setIsLoading(false);
        return;
      }

      // Valid OTP
      const auth = getAuth();
      // Sign in anonymously to establish a session
      const result = await signInAnonymously(auth);
      const anonUser = result.user;

      // Link this anonymous session to the User Document by updating the UID
      await updateDoc(doc(db, "users", userDoc.id), {
        uid: anonUser.uid,
        loginOTP: null, // Clear OTP
        loginOTPExpires: null
      });

      // Clear local fields
      setOtp("");
      setShowOTPInput(false);

      const userRole = userData.role || "user";
      navigate(userRole === "admin" ? "/admin" : "/user-dashboard");

    } catch (err) {
      console.error(err);
      setError("Verification failed. Please try again.");
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
        {/* TimeAway Branding */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-heading font-black bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 bg-clip-text text-transparent mb-1">
            TimeAway
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest">Leave Management System</p>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-4xl font-heading font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 dark:text-red-100 px-4 py-3 rounded-xl mb-6 text-sm text-center animate-pulse-slow">
            {error}
          </div>
        )}

        {showOTPInput ? (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Verification Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white text-center letter-spacing-widest text-lg"
                placeholder="123456"
                maxLength={6}
                required
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                Enter the 6-digit code sent to {email}. <br />
                <button type="button" onClick={() => setShowOTPInput(false)} className="text-primary-500 hover:text-primary-600 underline mt-1">Change Email</button>
              </p>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-primary-600/20 transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
              Verify & Login
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-primary-600/20 transform transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
                Send Verification Code
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-dark-card text-slate-500">Or continue with Google</span>
              </div>
            </div>

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
        )}
      </div>
    </div >
  );
}
