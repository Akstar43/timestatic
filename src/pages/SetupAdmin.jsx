// src/pages/SetupAdmin.jsx
// TEMPORARY PAGE - Use this to create your first admin user
import React, { useState } from "react";
import { getAuth, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, googleProvider } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

export default function SetupAdmin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const createAdminWithEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const auth = getAuth();

            // Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Add to Firestore with admin role
            await addDoc(collection(db, "users"), {
                uid: user.uid,
                email: email,
                name: name || email.split('@')[0],
                role: "admin",
                leaveDaysAssigned: 0,
                workingDays: [],
                organizationName: "",
                photoURL: "",
                createdAt: serverTimestamp()
            });

            setMessage("✅ Admin user created successfully! You can now log in.");
            setEmail("");
            setPassword("");
            setName("");

            setTimeout(() => {
                navigate("/login");
            }, 2000);

        } catch (err) {
            console.error(err);
            if (err.code === "auth/email-already-in-use") {
                setError("This email is already registered. Try logging in instead.");
            } else {
                setError("Error: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const createAdminWithGoogle = async () => {
        setLoading(true);
        setError("");
        setMessage("");

        try {
            const auth = getAuth();
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Add to Firestore with admin role
            await addDoc(collection(db, "users"), {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                role: "admin",
                leaveDaysAssigned: 0,
                workingDays: [],
                organizationName: "",
                photoURL: user.photoURL || "",
                createdAt: serverTimestamp()
            });

            setMessage("✅ Admin user created successfully! Redirecting to login...");

            setTimeout(() => {
                navigate("/login");
            }, 2000);

        } catch (err) {
            console.error(err);
            setError("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fixAdminProfile = async () => {
        setLoading(true);
        setError("");
        setMessage("Checking profile...");

        try {
            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {
                setError("You must be logged in to fix your profile. Please login normally first, then come back to this page.");
                setLoading(false);
                return;
            }

            console.log("Current Auth UID:", user.uid);

            // 1. Check if the "Correct" document already exists
            const correctDocRef = doc(db, "users", user.uid);
            const correctDocSnap = await getDoc(correctDocRef);

            if (correctDocSnap.exists()) {
                const data = correctDocSnap.data();
                if (data.role === 'admin') {
                    setMessage(`✅ Your profile is PERFECT! User Document ID matches Auth UID (${user.uid}) and role is 'admin'.`);
                    setLoading(false);
                    return;
                } else {
                    // It exists but maybe role is wrong?
                    await setDoc(correctDocRef, { role: 'admin' }, { merge: true });
                    setMessage("✅ Profile existed but was not admin. Updated role to 'admin'. You are set!");
                    setLoading(false);
                    return;
                }
            }

            // 2. The "Correct" document does NOT exist. We must find the "Wrong" one (Random ID)
            // Search by Email first (most reliable)
            const qEmail = query(collection(db, "users"), where("email", "==", user.email));
            const snapshot = await getDocs(qEmail);

            if (snapshot.empty) {
                // Try by stored uid field
                const qUid = query(collection(db, "users"), where("uid", "==", user.uid));
                const snapshotUid = await getDocs(qUid);

                if (snapshotUid.empty) {
                    setError("❌ Could not find ANY user profile for your email/uid. Please create a new admin user above.");
                    setLoading(false);
                    return;
                }
                snapshot = snapshotUid;
            }

            // We found the old profile!
            const oldDoc = snapshot.docs[0];
            const oldData = oldDoc.data();
            const oldId = oldDoc.id;

            console.log("Found old profile with Random ID:", oldId);

            // 3. Create the NEW profile with the CORRECT ID (user.uid)
            await setDoc(correctDocRef, {
                ...oldData,
                uid: user.uid, // Ensure this is definitely correct
                role: 'admin', // Force admin
                migratedFrom: oldId,
                updatedAt: serverTimestamp()
            });

            setMessage(`✅ Fixed! Migrated profile from ID: ${oldId} -> ${user.uid}. You now have full Admin access.`);

            // 4. Try to delete the old duplicate (Clean up)
            try {
                await deleteDoc(doc(db, "users", oldId));
                console.log("Successfully deleted old duplicate profile.");
                setMessage(prev => prev + " (Old duplicate deleted).");
            } catch (delErr) {
                console.warn("Could not delete old profile (likely permission issue), but that's okay. The new one works.");
                setMessage(prev => prev + " (Old duplicate still exists, but ignore it).");
            }

        } catch (err) {
            console.error(err);
            setError("Fix failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-900 p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl w-full max-w-md">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-heading font-bold text-white mb-2">Setup Admin</h2>
                    <p className="text-primary-100">Create your first admin user</p>
                    <p className="text-xs text-yellow-300 mt-2">⚠️ This is a one-time setup page</p>
                </div>

                {message && (
                    <div className="bg-green-500/20 border border-green-500/50 text-green-100 px-4 py-3 rounded-xl mb-6 text-sm text-center">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-xl mb-6 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={createAdminWithEmail} className="space-y-4 mb-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary-100 ml-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary-100 ml-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            placeholder="admin@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary-100 ml-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white py-3 rounded-xl font-semibold shadow-lg disabled:opacity-50"
                    >
                        {loading ? "Creating..." : "Create Admin User"}
                    </button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-transparent text-white/50">Or</span>
                    </div>
                </div>

                <button
                    onClick={createAdminWithGoogle}
                    disabled={loading}
                    className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3 rounded-xl font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Create Admin with Google
                </button>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-transparent text-white/50">Troubleshooting</span>
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <p className="text-sm text-primary-100 mb-3 text-center">
                        Is your Admin Access broken? <br />
                        (e.g. "Permission Denied" errors)
                    </p>
                    <button
                        onClick={fixAdminProfile}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold shadow-sm text-sm disabled:opacity-50"
                    >
                        🛠️ Fix Admin Profile
                    </button>
                    <p className="text-[10px] text-white/40 mt-2 text-center">
                        Migrates your user profile to match your Auth UID. <br />
                        You must be logged in as the admin user.
                    </p>
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate("/login")}
                        className="text-primary-200 hover:text-white text-sm underline"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}
