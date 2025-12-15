import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp, runTransaction, collection, writeBatch } from "firebase/firestore";
import { db } from "../firebase/firebase";
import toast, { Toaster } from "react-hot-toast";
import { BuildingOfficeIcon, UserIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export default function SignupCompany() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: "",
        adminName: "",
        email: ""
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const auth = getAuth();

            // Generate a random secure password (user won't know it, they use OTP/Google)
            const randomPassword = crypto.randomUUID() + crypto.randomUUID();

            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, randomPassword);
            const user = userCredential.user;

            // Update Auth Profile
            await updateProfile(user, { displayName: formData.adminName });

            // 2. Generate Org ID (Auto-ID via doc ref)
            const orgRef = doc(collection(db, "organizations"));
            const orgId = orgRef.id;

            // 3. Run Transaction to create Org + User atomically
            await runTransaction(db, async (transaction) => {
                // Create Organization
                transaction.set(orgRef, {
                    name: formData.companyName,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    plan: "free_trial",
                    subscriptionStatus: "active"
                });

                // Create Admin User linked to Org
                const userRef = doc(db, "users", user.uid);
                transaction.set(userRef, {
                    uid: user.uid,
                    name: formData.adminName,
                    email: formData.email,
                    role: "admin",
                    orgId: orgId, // <--- THE KEY LINK
                    organizationName: formData.companyName,
                    createdAt: serverTimestamp(),
                    photoURL: "",
                    leaveDaysAssigned: 0,
                    workingDays: []
                });
            });

            toast.success("Account created! PLEASE NOTE: Use 'Email OTP' or 'Google' to login next time.");

            // Redirect to dashboard (OrganizationContext will pick up the new OrgId)
            setTimeout(() => {
                navigate("/admin");
            }, 2500);

        } catch (error) {
            console.error("Signup failed:", error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center p-4 transition-colors duration-200">
            <Toaster position="top-right" />

            <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-white/5">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                            Start Your Free Trial
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Create a workspace for your team in seconds.
                        </p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">

                        {/* Company Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    name="companyName"
                                    required
                                    className="pl-10 w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                                    placeholder="Acme Inc."
                                    value={formData.companyName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Admin Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    name="adminName"
                                    required
                                    className="pl-10 w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                                    placeholder="John Doe"
                                    value={formData.adminName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Work Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <EnvelopeIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    className="pl-10 w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                                    placeholder="john@acme.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-lg text-xs flex gap-2">
                            <span>ℹ️</span>
                            <span>No password required. You will login via <strong>Email OTP</strong> or <strong>Google</strong>.</span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-500 hover:to-secondary-500 text-white py-3.5 rounded-xl font-bold shadow-lg transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Creating Workspace..." : "Create Workspace"}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
