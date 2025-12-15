// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, storage } from "../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../context/OrganizationContext";
import {
    UserCircleIcon,
    EnvelopeIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    ArrowLeftIcon,
    CameraIcon,
    CheckCircleIcon,
    XCircleIcon
} from "@heroicons/react/24/outline";
import toast, { Toaster } from "react-hot-toast";
import ThemeToggle from "../components/ThemeToggle";
import { LEAVE_CATEGORIES } from "../context/leavetypes";
import { useTheme } from "../context/ThemeContext";
import { THEMES as ALL_THEMES } from "../context/themes";

export default function Profile() {
    const auth = getAuth();
    const navigate = useNavigate();
    const themeCtx = useTheme() || {};
    const changeTheme = typeof themeCtx.changeTheme === 'function' ? themeCtx.changeTheme : () => console.warn('changeTheme not ready');
    const currentTheme = themeCtx.currentTheme || 'blue';
    const themes = themeCtx.themes;
    const currentUserId = auth.currentUser?.uid;

    const [userData, setUserData] = useState(null);
    const [userDocId, setUserDocId] = useState(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [organization, setOrganization] = useState("");
    const [photoURL, setPhotoURL] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [leaves, setLeaves] = useState([]);
    const [holidays, setHolidays] = useState({});

    const { org } = useOrganization();
    const orgId = org?.id;

    useEffect(() => {
        if (currentUserId && orgId) {
            loadUserData();
            loadLeaves();
            loadHolidays();
        }
    }, [currentUserId, orgId]);

    // ... loadUserData remains same (fetches by UID) ...

    async function loadUserData() {
        if (!currentUserId) return;
        try {
            const q = query(collection(db, "users"), where("uid", "==", currentUserId));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                setUserDocId(doc.id);
                setUserData({ ...data, id: doc.id }); // Add Firestore doc ID to userData
                setName(data.name || "");
                setEmail(data.email || "");
                setOrganization(data.organizationName || "");
                setPhotoURL(data.photoURL || "");
            }
        } catch (error) {
            toast.error("Failed to load profile data");
            console.error(error);
        }
    }

    async function loadLeaves() {
        try {
            // Filter by Org AND User (Optimization)
            // Or just User? 
            // Better to filter by Org for security, then User for view
            // Actually, querying just by Org is unsafe if many users. 
            // Better: query(collection, where("userId", "==", userFirestoreId))
            // BUT we don't have userFirestoreId in state securely until loadUserData finishes.

            // For now, let's keep it simple: Fetch My Leaves by my UID (if stored on leave) or filter client side
            // Ideally: query(collection(db, "leaveRequests"), where("userId", "==", userDocId))
            // But we might not have userDocId yet. 

            // Let's use the orgId filter as a base layer if possible, or just fetch all and filter client side (legacy style)
            // Wait, we can query by orgId AND userId if we have composite index.

            // Current approach in UserDashboard: fetch ALL leaves for Org.
            const q = query(collection(db, "leaveRequests"), where("orgId", "==", orgId));
            const snapshot = await getDocs(q);
            const allLeaves = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setLeaves(allLeaves);
        } catch (error) {
            console.error("Failed to load leaves:", error);
        }
    }

    async function loadHolidays() {
        try {
            const q = query(collection(db, "publicHolidays"), where("orgId", "==", orgId));
            const snapshot = await getDocs(q);
            const holidayData = {};
            snapshot.docs.forEach(d => {
                const data = d.data();
                holidayData[data.date] = data.name;
            });
            setHolidays(holidayData);
        } catch (error) {
            console.error("Failed to load holidays:", error);
        }
    }

    async function handleSave() {
        if (!userDocId) return toast.error("User document not found");

        try {
            await updateDoc(doc(db, "users", userDocId), {
                name,
                organizationName: organization
            });

            setUserData(prev => ({ ...prev, name, organizationName: organization }));
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (error) {
            toast.error("Failed to update profile");
            console.error(error);
        }
    }

    async function handlePhotoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error("Please upload an image file");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image size should be less than 5MB");
            return;
        }

        setUploading(true);
        try {
            const storageRef = ref(storage, `profile-pictures/${currentUserId}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(doc(db, "users", userDocId), {
                photoURL: downloadURL
            });

            setPhotoURL(downloadURL);
            setUserData(prev => ({ ...prev, photoURL: downloadURL }));
            toast.success("Profile picture updated");
        } catch (error) {
            toast.error("Failed to upload photo");
            console.error(error);
        } finally {
            setUploading(false);
        }
    }

    async function cancelLeave(id) {
        if (!window.confirm("Are you sure you want to cancel this leave?")) return;
        try {
            await updateDoc(doc(db, "leaveRequests", id), {
                status: "Cancelled",
                cancelledAt: Date.now()
            });
            // Update local state
            setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: "Cancelled" } : l));
            toast.success("Leave cancelled successfully");

            // Note: Balance is automatically restored because 'getLeaveStats' and 'getLeaveBalance' 
            // only count "Approved" leaves. Cancelled leaves are ignored.
        } catch (error) {
            console.error("Error cancelling leave:", error);
            toast.error("Failed to cancel leave");
        }
    }

    // Helper to check if a date is a non-working day (based on user's working days config)
    const isNonWorkingDay = (date, user) => {
        if (!user || !user.workingDays || user.workingDays.length === 0) {
            // Default: Saturday and Sunday are non-working
            const dayOfWeek = date.getDay();
            return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        }

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayName = dayNames[date.getDay()];
        return !user.workingDays.includes(dayName);
    };

    // Helper to calculate business days (excluding non-working days and holidays)
    function calculateLeaveDuration(fromStr, toStr, isHalfDay = false) {
        const start = new Date(fromStr);
        const end = new Date(toStr);
        let count = 0;
        let curr = new Date(start);

        while (curr <= end) {
            const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;

            // Only count if it's NOT a non-working day AND NOT a holiday
            if (!isNonWorkingDay(curr, userData) && !holidays[dateStr]) {
                count++;
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (count === 0) return 0;
        return isHalfDay ? 0.5 : count;
    }

    function getLeaveStats() {
        if (!userData) return { total: 0, used: 0, remaining: 0, approved: 0, pending: 0, rejected: 0 };

        const total = userData.leaveDaysAssigned || 0;

        // Filter leaves for THIS user by Firestore document ID (not Auth UID)
        // Match UserDashboard logic exactly
        const userLeaves = leaves.filter(l => l.userId === userData.id);

        // Count approved deductable leave days (business days only)
        const used = userLeaves
            .filter(l => {
                const categoryInfo = LEAVE_CATEGORIES[l.category];
                return l.status === "Approved" && categoryInfo?.type === "Deductable";
            })
            .reduce((sum, l) => {
                return sum + calculateLeaveDuration(l.from, l.to, l.isHalfDay);
            }, 0);

        // Count number of requests by status
        const approved = userLeaves.filter(l => l.status === "Approved").length;
        const pending = userLeaves.filter(l => l.status === "Pending").length;
        const rejected = userLeaves.filter(l => l.status === "Rejected").length;

        return { total, used, remaining: total - used, approved, pending, rejected };
    }

    const stats = getLeaveStats();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans transition-colors duration-200">
            <Toaster position="top-right" toastOptions={{
                style: {
                    background: '#1e293b',
                    color: '#fff',
                }
            }} />

            {/* Header */}
            <header className="bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/5 px-4 sm:px-8 py-4 sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-dark-card/80 transition-colors duration-200">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/user-dashboard')}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-heading font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
                            My Profile
                        </h1>
                    </div>
                    <ThemeToggle />
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8 animate-fade-in">
                {/* Profile Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
                    {/* Cover Image */}
                    <div className="h-32 bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600"></div>

                    {/* Profile Info */}
                    <div className="px-4 sm:px-8 pb-8">
                        <div className="flex flex-col md:flex-row gap-6 -mt-16 mb-6">
                            {/* Profile Picture */}
                            <div className="relative">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center border-4 border-white dark:border-dark-card shadow-xl transition-all duration-200">
                                    {photoURL ? (
                                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white font-bold text-4xl">{name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 p-2 bg-primary-600 hover:bg-primary-500 rounded-full cursor-pointer shadow-lg transition-colors">
                                    <CameraIcon className="h-5 w-5 text-white" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={uploading}
                                    />
                                </label>
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    </div>
                                )}
                            </div>

                            {/* User Info */}
                            <div className="flex-1 mt-16 md:mt-0">
                                {!isEditing ? (
                                    <div className="space-y-4">
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md">{name || "User"}</h2>
                                            <p className="text-slate-500 dark:text-slate-400 mt-1">{email}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
                                                <span>{organization || "No organization"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                <CalendarDaysIcon className="h-5 w-5 text-slate-400" />
                                                <span>{stats.remaining} days remaining</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="mt-4 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20"
                                        >
                                            Edit Profile
                                        </button>

                                        {((/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && (
                                            <button
                                                onClick={async () => {
                                                    const { requestAndSaveNotificationPermission } = await import("../services/notificationService");
                                                    const success = await requestAndSaveNotificationPermission(currentUserId);
                                                    if (success) toast.success("Notifications Enabled!");
                                                    else toast("Please check browser settings if prompt didn't appear.");
                                                }}
                                                className="mt-4 ml-4 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                                            >
                                                Enable Notifications (iOS)
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-500 dark:text-slate-400 ml-1">Full Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-500 dark:text-slate-400 ml-1">Email (Read-only)</label>
                                            <input
                                                type="email"
                                                value={email}
                                                disabled
                                                className="w-full bg-slate-100 dark:bg-dark-bg/50 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm text-slate-500 dark:text-slate-400 ml-1">Organization (Read-only)</label>
                                            <input
                                                type="text"
                                                value={organization}
                                                disabled
                                                className="w-full bg-slate-100 dark:bg-dark-bg/50 border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="flex gap-3 mt-6">
                                            <button
                                                onClick={handleSave}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                                            >
                                                <CheckCircleIcon className="h-5 w-5" />
                                                Save Changes
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setName(userData?.name || "");
                                                    setOrganization(userData?.organizationName || "");
                                                }}
                                                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personalize Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden p-6 transition-colors duration-200">
                    <h3 className="text-lg font-heading font-semibold text-slate-900 dark:text-white mb-4">
                        Personalize Look
                    </h3>
                    <div className="flex gap-4 flex-wrap">
                        {(themes || ALL_THEMES) && Object.entries(themes || ALL_THEMES).map(([key, theme]) => (
                            <button
                                key={key}
                                onClick={() => changeTheme(key)}
                                className={`
                                    group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
                                    ${(currentTheme || 'blue') === key ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-white dark:ring-offset-dark-card scale-110' : 'hover:scale-105'}
                                `}
                                title={theme.name}
                            >
                                {/* Color Preview Circle */}
                                <div
                                    className="w-full h-full rounded-full shadow-inner"
                                    style={{ backgroundColor: `rgb(${theme.colors[500]})` }}
                                />

                                {/* Active Checkmark */}
                                {(currentTheme || 'blue') === key && (
                                    <CheckCircleIcon className="absolute w-6 h-6 text-white drop-shadow-md" />
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                        Select your favorite accent color for buttons and highlights.
                    </p>
                </div>

                {/* Leave Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-gradient-to-br from-primary-600 to-primary-700 border border-primary-500/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-primary-100 text-sm font-medium">Total Leave Days</span>
                            <CalendarDaysIcon className="h-5 w-5 text-primary-200" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.total}</div>
                        <p className="text-xs text-primary-200 mt-1">Allocated this year</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 border border-emerald-500/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-emerald-100 text-sm font-medium">Remaining</span>
                            <CalendarDaysIcon className="h-5 w-5 text-emerald-200" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.remaining}</div>
                        <p className="text-xs text-emerald-200 mt-1">Available to use</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-600 to-amber-700 border border-amber-500/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-amber-100 text-sm font-medium">Pending</span>
                            <CalendarDaysIcon className="h-5 w-5 text-amber-200" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.pending}</div>
                        <p className="text-xs text-amber-200 mt-1">Awaiting approval</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 border border-blue-500/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-blue-100 text-sm font-medium">Approved</span>
                            <CheckCircleIcon className="h-5 w-5 text-blue-200" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.approved}</div>
                        <p className="text-xs text-blue-200 mt-1">Requests approved</p>
                    </div>

                    <div className="bg-gradient-to-br from-red-600 to-red-700 border border-red-500/20 rounded-2xl shadow-xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-red-100 text-sm font-medium">Rejected</span>
                            <XCircleIcon className="h-5 w-5 text-red-200" />
                        </div>
                        <div className="text-3xl font-bold text-white">{stats.rejected}</div>
                        <p className="text-xs text-red-200 mt-1">Requests rejected</p>
                    </div>
                </div>

                {/* Recent Leave Requests */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
                    <div className="p-6 border-b border-slate-200 dark:border-white/5">
                        <h2 className="text-xl font-heading font-semibold text-slate-900 dark:text-white">Recent Leave Requests</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Dates</th>
                                    <th className="px-6 py-4 font-medium">Type</th>
                                    <th className="px-6 py-4 font-medium">Category</th>
                                    <th className="px-6 py-4 font-medium">Reason</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                {leaves.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                            No leave requests yet
                                        </td>
                                    </tr>
                                ) : (
                                    leaves.map(leave => (
                                        <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col text-sm">
                                                    <span>{new Date(leave.from).toLocaleDateString()}</span>
                                                    <span className="text-slate-400 dark:text-slate-600">to</span>
                                                    <span>{new Date(leave.to).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${leave.type === 'Deductable'
                                                    ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
                                                    : 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                                                    }`}>
                                                    {leave.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{leave.category}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{leave.reason || "-"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${leave.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' :
                                                    leave.status === 'Rejected' ? 'bg-red-500/20 text-red-600 dark:text-red-300' :
                                                        leave.status === 'Cancelled' ? 'bg-slate-500/20 text-slate-600 dark:text-slate-300' :
                                                            'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                                                    }`}>
                                                    {leave.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(leave.status === 'Pending' || leave.status === 'Approved') && (
                                                    <button
                                                        onClick={() => cancelLeave(leave.id)}
                                                        className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-1.5 rounded border border-red-200 dark:border-red-900/30 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main >
        </div >
    );
}
