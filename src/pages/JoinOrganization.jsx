import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, getAuth } from "firebase/auth";
import { db, auth } from "../firebase/firebase";
import toast, { Toaster } from "react-hot-toast";
import { UserPlusIcon, ArrowRightIcon, EyeIcon, EyeSlashIcon, LockClosedIcon } from "@heroicons/react/24/outline";

export default function JoinOrganization() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(true);
    const [validInvite, setValidInvite] = useState(null); // { id, ...data }
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("Missing invitation token.");
            setLoading(false);
            return;
        }
        verifyToken();
    }, [token]);

    async function verifyToken() {
        try {
            const q = query(collection(db, "invitations"), where("token", "==", token));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setError("Invalid or expired invitation.");
                setLoading(false);
                return;
            }

            const inviteDoc = snapshot.docs[0];
            const inviteData = inviteDoc.data();

            if (inviteData.status === 'accepted') {
                setError("This invitation has already been used.");
                setLoading(false);
                return;
            }

            // Check expiry if you added expiresAt (optional for now)

            setValidInvite({ id: inviteDoc.id, ...inviteData });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Failed to verify invitation.");
            setLoading(false);
        }
    }

    async function handleJoin(e) {
        e.preventDefault();
        if (!name) return toast.error("Please fill all fields");

        setIsSubmitting(true);
        try {
            // Generate Random Password
            const randomPassword = crypto.randomUUID() + crypto.randomUUID();

            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, validInvite.email, randomPassword);
            const user = userCredential.user;

            // 2. Update Profile
            await updateProfile(user, { displayName: name });

            // 3. Create Firestore User (Linked to Org)
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: validInvite.email,
                role: validInvite.role || 'user',
                orgId: validInvite.orgId,
                organizationName: validInvite.orgName,
                leaveDaysAssigned: 0,
                workingDays: [],
                photoURL: "",
                createdAt: serverTimestamp()
            });

            // 4. Mark Invite as Accepted (or delete it)
            await updateDoc(doc(db, "invitations", validInvite.id), {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                acceptedBy: user.uid
            });

            toast.success("Welcome aboard! Please login via OTP/Google next time.");

            // Wait a moment for auth state to settle
            setTimeout(() => {
                navigate("/user-dashboard");
            }, 2500);

        } catch (err) {
            console.error("Join error:", err);
            // Handle "email-already-in-use" gracefully?
            if (err.code === 'auth/email-already-in-use') {
                toast.error("Account already exists. Please login instead.");
            } else {
                toast.error("Failed to join organization: " + err.message);
            }
            setIsSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                <div className="animate-pulse">Verifying invitation...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlusIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invitation Error</h1>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <Link to="/login" className="text-blue-600 hover:underline font-medium">Return to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            <Toaster />
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                    Join {validInvite.orgName}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    Create your account to accept the invitation
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleJoin}>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Email Address
                            </label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    disabled
                                    value={validInvite.email}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Full Name
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-lg text-xs flex gap-2">
                            <span>ℹ️</span>
                            <span>No password needed. You will login via <strong>Email OTP</strong> or <strong>Google</strong>.</span>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? "Creating Account..." : "Create Account & Join"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
