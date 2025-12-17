// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { db, ts } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { LEAVE_CATEGORIES } from "../context/leavetypes"; // Shared categories
import { useOrganization } from "../context/OrganizationContext";
import toast, { Toaster } from "react-hot-toast";
import {
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";
import ThemeToggle from "../components/ThemeToggle";
import { sendNewLeaveRequestEmail, sendLeaveStatusEmail } from "../services/emailService";
import { checkAndNotifyLowBalance } from "../services/notificationService";
import { calculateLeaveDuration, isNonWorkingDay } from "../utils/leaveCalculations";

export default function UserDashboard() {
  const auth = getAuth();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to logout");
    }
  };

  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [timePeriod, setTimePeriod] = useState("Full Day"); // Demo for single day or legacy
  const [startHalfType, setStartHalfType] = useState("Full Day"); // "Full Day" | "Morning" | "Afternoon"
  const [endHalfType, setEndHalfType] = useState("Full Day"); // "Full Day" | "Morning" | "Afternoon"
  const [selectedLeaveType, setSelectedLeaveType] = useState("Deductable");
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [reason, setReason] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { org } = useOrganization();
  const orgId = org?.id;

  // Simple hardcoded holidays for demo purposes
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (orgId) {
      loadHolidays();
      loadUsers();
      loadLeaves();
    }
  }, [orgId]);

  async function loadHolidays() {
    try {
      // Load Org Holidays + Maybe Global ones?
      // For now, strict isolation: Only Org Holidays
      const q = query(collection(db, "publicHolidays"), where("orgId", "==", orgId));
      const snapshot = await getDocs(q);
      const holidayData = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        holidayData[data.date] = data.name;
      });
      setHolidays(holidayData);
    } catch (err) {
      console.error("Error loading holidays:", err);
    }
  }

  const getHoliday = (date) => {
    const d = new Date(date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return holidays[dateStr];
  };

  // Helper to check if a date is a non-working day (based on user's working days config)
  // const isNonWorkingDay = (date, user) => ... (Moved to utils)




  // Update filtered category when type changes
  useEffect(() => {
    const validCategories = Object.keys(LEAVE_CATEGORIES).filter(cat => LEAVE_CATEGORIES[cat].type === selectedLeaveType);
    if (validCategories.length > 0 && (!LEAVE_CATEGORIES[leaveCategory] || LEAVE_CATEGORIES[leaveCategory].type !== selectedLeaveType)) {
      setLeaveCategory(validCategories[0]);
    }
  }, [selectedLeaveType]);

  async function loadUsers() {
    try {
      const q = query(collection(db, "users"), where("orgId", "==", orgId));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out Shadow Docs (OTP Bridges)
      setUsers(usersData.filter(u => !u.isShadow));
      if (currentUserId) {
        const authUser = auth.currentUser;
        setCurrentUserData(usersData.find(u => u.uid === currentUserId || (authUser?.email && u.email?.toLowerCase() === authUser.email.toLowerCase())) || null);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  async function loadLeaves() {
    try {
      const q = query(collection(db, "leaveRequests"), where("orgId", "==", orgId));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeaves(docs);
    } catch (err) {
      console.error("Error loading leaves:", err);
    }
  }

  // Calculate leave balance for current user
  function getLeaveBalance() {
    if (!currentUserData) return { total: 0, used: 0, remaining: 0 };

    // Convert holidays array to map for O(1) lookup
    const holidayMap = {};
    if (Array.isArray(holidays)) {
      holidays.forEach(h => holidayMap[h.date] = h.name);
    }

    const total = currentUserData.leaveDaysAssigned || 0;
    const used = leaves
      .filter(l => {
        const categoryInfo = LEAVE_CATEGORIES[l.category];
        return l.userId === currentUserData.id &&
          l.status === "Approved" &&
          categoryInfo?.type === "Deductable";
      })
      .reduce((sum, l) => {
        // Handle legacy and new structure
        const isSingle = l.from === l.to;
        return sum + calculateLeaveDuration(l.from, l.to, isSingle, l.halfType || l.timePeriod, l.startHalfType || "Full Day", l.endHalfType || "Full Day", currentUserData, holidayMap);
      }, 0);

    return { total, used, remaining: total - used };
  }

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function dateFromDateString(ds, hour = 9, minute = 0) {
    // ds expected "YYYY-MM-DD"
    const parts = ds.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
    return dt;
  }

  function formatDateShort(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function prevWeek() {
    setSelectedWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return new Date(d);
    });
  }

  function nextWeek() {
    setSelectedWeek(new Date(selectedWeek.setDate(selectedWeek.getDate() + 7)));
  }

  function getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function parseStoredDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isLeaveOnDate(leave, date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const start = parseStoredDate(leave.from);
    const end = parseStoredDate(leave.to);

    if (!start || !end) return false;

    return d >= start && d <= end;
  }

  async function bookLeave() {
    if (isSubmitting) return; // Prevent double-click
    if (!currentUserId) return toast.error("User not found, login again.");
    if (!fromDateStr || !toDateStr) return toast.error("Select leave dates");

    try {
      setIsSubmitting(true);

      const categoryInfo = LEAVE_CATEGORIES[leaveCategory];
      const isSingleDay = fromDateStr === toDateStr;

      if (!currentUserData?.id) return toast.error("User profile not found. Please contact admin.");

      // Convert holidays array to map for O(1) lookup
      const holidayMap = {};
      if (Array.isArray(holidays)) {
        holidays.forEach(h => holidayMap[h.date] = h.name);
      }

      // Calculate requested duration using business days logic
      const requestedDays = calculateLeaveDuration(fromDateStr, toDateStr, isSingleDay, timePeriod, startHalfType, endHalfType, currentUserData, holidayMap);

      if (requestedDays === 0) {
        return toast.error("Selected dates are non-working days or holidays.");
      }

      // Get current balance
      const { total, used } = getLeaveBalance();

      // Calculate pending usage to prevent overbooking
      const pendingUsage = leaves
        .filter(l => {
          const cat = LEAVE_CATEGORIES[l.category];
          return l.userId === currentUserData.id &&
            l.status === "Pending" &&
            l.id !== "temp" && // Exclude optimistic (if any)
            cat?.type === "Deductable";
        })
        .reduce((sum, l) => {
          const isSingle = l.from === l.to;
          return sum + calculateLeaveDuration(l.from, l.to, isSingle, l.halfType || l.timePeriod, l.startHalfType || "Full Day", l.endHalfType || "Full Day", currentUserData, holidayMap);
        }, 0);

      const availableBalance = total - used - pendingUsage;

      // Auto-Rejection Logic
      let status = "Pending";
      let adminResponse = "";
      let isAutoRejected = false;

      if (categoryInfo?.type === "Deductable") {
        if (total === 0) {
          status = "Rejected";
          adminResponse = "System: No leave days allocated.";
          isAutoRejected = true;
        } else if (requestedDays > availableBalance) {
          status = "Rejected";
          adminResponse = `System: Insufficient balance. Requested ${requestedDays} days, but you only have ${availableBalance} days available (including pending requests).`;
          isAutoRejected = true;
        }
      }

      const leave = {
        userId: currentUserData.id, // Standardize on Firestore ID
        userName: currentUserData.name || "Unknown User",
        orgId: orgId, // <--- Link to Org
        from: fromDateStr,
        to: toDateStr,
        type: categoryInfo.type,
        category: leaveCategory,
        reason,
        // Store relevant half-day info depending on if it's single or multi
        isSingleDay,
        halfType: isSingleDay ? timePeriod : null,
        startHalfType: !isSingleDay ? startHalfType : null,
        endHalfType: !isSingleDay ? endHalfType : null,
        status, // Pending or Rejected
        adminResponse: isAutoRejected ? adminResponse : null,
        createdAt: ts()
      };

      const docRef = await addDoc(collection(db, "leaveRequests"), leave);

      if (isAutoRejected) {
        toast.error("Leave Request Auto-Rejected: Insufficient Balance");
      } else {
        toast.success("Leave request submitted successfully");
      }

      setFromDateStr(""); setToDateStr(""); setReason("");
      setLeaveCategory("Holiday");
      setTimePeriod("Full Day");
      setIsBookingOpen(false); // Close form

      const leaveWithId = { ...leave, id: docRef.id };

      // Send Email Notification to Admin
      const adminEmailResult = await sendNewLeaveRequestEmail(leaveWithId, leave.userName);
      if (!adminEmailResult.success) {
        console.warn("Failed to send admin email:", adminEmailResult.error);
      }

      // Send Confirmation/Rejection Email to User
      const userEmail = currentUserData?.email;
      if (userEmail) {
        const userEmailResult = await sendLeaveStatusEmail(userEmail, leave.userName, status, leave, isAutoRejected ? adminResponse : "");
        if (!userEmailResult.success) {
          console.warn("Failed to send user confirmation email:", userEmailResult.error);
        }
      }

      // Check for Low Balance and Notify User
      const currentBalance = total - used - pendingUsage - requestedDays;
      checkAndNotifyLowBalance(currentBalance, currentUserData.id);

      loadLeaves();

    } catch (err) {
      console.error(err);
      toast.error("Failed to submit leave request");
    } finally {
      setIsSubmitting(false);
    }
  }

  const weekDates = getWeekDates(selectedWeek);
  // Get color based on leave category
  const getCategoryColor = (category) => {
    return LEAVE_CATEGORIES[category]?.color || 'bg-slate-500';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text font-sans transition-colors duration-200">
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e293b',
          color: '#fff',
        }
      }} />
      {/* Header */}
      <header className="bg-white dark:bg-dark-card border-b border-slate-200 dark:border-white/5 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-dark-card/80 transition-colors duration-200">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-heading font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
          User Dashboard
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {currentUserData?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              title="Switch to Admin View"
            >
              <Cog6ToothIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Admin View</span>
            </button>
          )}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              {currentUserData?.photoURL ? (
                <img src={currentUserData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-medium text-xs sm:text-sm">{currentUserData?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-slate-700 dark:text-white">{currentUserData?.name || 'User'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">View Profile</div>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-2 sm:px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
        {/* Leave Balance Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 border border-primary-500/20 rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary-100 text-xs sm:text-sm font-medium">Total Leave Days</span>
              <CalendarDaysIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-200" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{getLeaveBalance().total}</div>
            <p className="text-xs text-primary-200 mt-1">Allocated this year</p>
          </div>

          <div className="bg-gradient-to-br from-amber-600 to-amber-700 border border-amber-500/20 rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-100 text-xs sm:text-sm font-medium">Used Days</span>
              <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-200" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{getLeaveBalance().used}</div>
            <p className="text-xs text-amber-200 mt-1">Deductable leaves taken</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 border border-emerald-500/20 rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-100 text-xs sm:text-sm font-medium">Remaining Days</span>
              <CalendarDaysIcon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-200" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{getLeaveBalance().remaining}</div>
            <p className="text-xs text-emerald-200 mt-1">Available to use</p>
          </div>
        </div>

        {/* User Actions */}
        {/* User Actions */}
        <div className="flex justify-end pb-4 sm:pb-0">
          <button
            className={`${isBookingOpen ? 'bg-red-600 hover:bg-red-500' : 'bg-primary-600 hover:bg-primary-500'} text-white w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 transition-all hover:-translate-y-0.5`}
            onClick={() => setIsBookingOpen(!isBookingOpen)}
          >
            {isBookingOpen ? (
              <>Cancel Booking</>
            ) : (
              <>
                <PlusCircleIcon className="h-6 w-6" />
                Book New Leave
              </>
            )}
          </button>
        </div>

        {/* Leave Booking Card */}
        {isBookingOpen && (
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl p-4 sm:p-6 animate-fade-in transition-colors duration-200">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <PlusCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-400" />
              </div>
              <h2 className="text-lg sm:text-xl font-heading font-semibold">Request Leave</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">From (date)</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  value={fromDateStr}
                  onChange={e => setFromDateStr(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">To (date)</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  value={toDateStr}
                  onChange={e => setToDateStr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">Leave Type</label>
                <select
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  value={selectedLeaveType}
                  onChange={e => setSelectedLeaveType(e.target.value)}
                >
                  <option value="Deductable">Deductable</option>
                  <option value="Non-Deductable">Non-Deductable</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">Leave Category</label>
                <select
                  className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                  value={leaveCategory}
                  onChange={e => setLeaveCategory(e.target.value)}
                >
                  {Object.keys(LEAVE_CATEGORIES)
                    .filter(cat => LEAVE_CATEGORIES[cat].type === selectedLeaveType)
                    .map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
              </div>

              {fromDateStr && toDateStr && fromDateStr !== toDateStr ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">Start Day Type</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                      value={startHalfType}
                      onChange={e => setStartHalfType(e.target.value)}
                    >
                      <option value="Full Day">Full Day</option>
                      <option value="Morning">Start of Day (Morning)</option>
                      <option value="Afternoon">Afternoon</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">End Day Type</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                      value={endHalfType}
                      onChange={e => setEndHalfType(e.target.value)}
                    >
                      <option value="Full Day">Full Day</option>
                      <option value="Morning">Start of Day (Morning)</option>
                      <option value="Afternoon">Afternoon</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">Time Period</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                    value={timePeriod}
                    onChange={e => setTimePeriod(e.target.value)}
                  >
                    <option value="Full Day">Full Day</option>
                    <option value="Morning">Start of Day (Morning)</option>
                    <option value="Afternoon">Afternoon</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
              <input
                className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                placeholder="Reason for leave..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <button
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 sm:px-8 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={bookLeave}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        )}

        {/* Weekly Calendar */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5">
            {/* Header with icon and title */}
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="p-2 bg-secondary-500/10 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-heading font-semibold text-slate-900 dark:text-white">Team Leave Calendar</h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
                </p>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-2 justify-center sm:justify-end">
              <button
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-600 dark:text-slate-300 font-medium text-sm"
                onClick={prevWeek}
                title="Previous Week"
              >
                <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">Prev</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                onClick={() => setSelectedWeek(getMonday(new Date()))}
                title="Jump to Current Week"
              >
                <CalendarDaysIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Today</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-600 dark:text-slate-300 font-medium text-sm"
                onClick={nextWeek}
                title="Next Week"
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-dark-bg/30">
            <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2">Leave Types:</span>
                {Object.entries(LEAVE_CATEGORIES).map(([category, info]) => (
                  <div key={category} className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${info.color}`}></div>
                    <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{category}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 items-center border-l border-slate-300 dark:border-white/10 pl-4">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">Approved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500 opacity-60 ring-2 ring-amber-400"></div>
                  <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">Pending (You)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="px-0 sm:px-0">
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden p-2 sm:p-6">

              {/* Scrollable Wrapper */}
              <div className="overflow-x-auto">
                <div className="min-w-full">

                  {/* Day headers - just the letters */}
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[140px_repeat(7,1fr)] lg:grid-cols-[180px_repeat(7,1fr)] gap-0.5 sm:gap-2 mb-2 sm:mb-4">
                    <div></div>
                    {DAYS.map((day, idx) => {
                      const date = weekDates[idx];
                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <div key={idx} className="text-center flex justify-center">
                          <span className={`text-[10px] sm:text-xs font-bold uppercase w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all
                              ${isToday
                              ? 'ring-2 ring-primary-600 text-primary-600 dark:text-primary-400 dark:ring-primary-500'
                              : 'text-slate-400 dark:text-slate-500'
                            }`}>
                            {day.charAt(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* User rows */}
                  <div className="space-y-1.5 sm:space-y-3 pb-2">
                    {users.length > 0 ? users.map(user => (
                      <div key={user.id} className="grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[140px_repeat(7,1fr)] lg:grid-cols-[180px_repeat(7,1fr)] gap-0.5 sm:gap-2 items-center">
                        {/* User info */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full overflow-hidden shadow-sm ring-2 ring-slate-100 dark:ring-white/10">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                                  <span className="text-slate-600 dark:text-slate-300 font-bold text-[10px] sm:text-xs lg:text-sm">{user.name?.charAt(0) || 'U'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] sm:text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user.name || 'Unknown'}</div>
                            <div className="text-[9px] sm:text-[10px] lg:text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:block">{user.email?.split('@')[0]}</div>
                          </div>
                        </div>

                        {/* Date cells as circles */}
                        {weekDates.map((date, dayIdx) => {
                          const holiday = getHoliday(date);
                          const isNonWorking = isNonWorkingDay(date, user);
                          const shouldBeGrey = holiday || isNonWorking;
                          const isToday = date.toDateString() === new Date().toDateString();

                          // Only show leave colors on working days (not weekends/holidays)
                          // Privacy: Show pending leaves only for current user, approved for everyone
                          const userLeavesOnDay = !shouldBeGrey
                            ? leaves.filter(l => {
                              if (l.userId !== user.id) return false;
                              if (!isLeaveOnDate(l, date)) return false;
                              if (l.status === "Rejected" || l.status === "Cancelled") return false;

                              // Show pending only if it's the current user's own leave
                              if (l.status === "Pending" && l.userId !== currentUserData?.id) return false;

                              return true;
                            })
                            : [];

                          const hasLeave = userLeavesOnDay.length > 0;
                          const leave = userLeavesOnDay[0]; // Take first leave if multiple

                          return (
                            <div key={dayIdx} className="flex justify-center">
                              {hasLeave ? (
                                (() => {
                                  // Determine if THIS specific day is a half day
                                  let isDayHalf = false;
                                  let halfType = null;

                                  const dateStr = date.toDateString();
                                  const startStr = new Date(leave.from).toDateString();
                                  const endStr = new Date(leave.to).toDateString();

                                  if (leave.isSingleDay || leave.from === leave.to) {
                                    // Single Day Logic
                                    if (leave.halfType && leave.halfType !== "Full Day") {
                                      isDayHalf = true;
                                      halfType = leave.halfType;
                                    }
                                  } else {
                                    // Multi Day Logic
                                    if (dateStr === startStr && leave.startHalfType && leave.startHalfType !== "Full Day") {
                                      isDayHalf = true;
                                      halfType = leave.startHalfType;
                                    } else if (dateStr === endStr && leave.endHalfType && leave.endHalfType !== "Full Day") {
                                      isDayHalf = true;
                                      halfType = leave.endHalfType;
                                    }
                                  }

                                  return isDayHalf ? (
                                    // Partial Day Visual
                                    <div className={`relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 flex items-center justify-center ${leave.status === 'Pending' ? 'ring-2 ring-dashed ring-amber-400' : ''}`}>
                                      <div
                                        className={`absolute inset-0 rounded-full ${getCategoryColor(leave.category)} ${leave.status === 'Pending' ? 'opacity-60' : ''}`}
                                        style={{
                                          clipPath: (halfType === 'Morning' || halfType === 'Start of Day (Morning)')
                                            ? 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' // Left half
                                            : 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)' // Right half
                                        }}
                                      />
                                      <span
                                        className="relative z-10 text-[10px] sm:text-[11px] lg:text-xs font-bold text-slate-700 dark:text-slate-300 cursor-help"
                                        title={`${leave.category} (${halfType})\n${leave.reason || ''}\nStatus: ${leave.status}`}
                                      >
                                        {date.getDate()}
                                      </span>
                                    </div>
                                  ) : (
                                    // Full Day Visual
                                    <div
                                      className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] lg:text-xs font-bold text-white shadow-sm cursor-help transition-transform hover:scale-110 ${getCategoryColor(leave.category)} ${leave.status === 'Pending' ? 'opacity-60 ring-2 ring-amber-400 ring-offset-1' : ''}`}
                                      title={`${leave.category}\n${leave.reason || ''}\nStatus: ${leave.status}`}
                                    >
                                      {date.getDate()}
                                    </div>
                                  );
                                })()
                              ) : (
                                // Regular date circle (including non-working days)
                                <div
                                  className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-[11px] sm:text-xs lg:text-sm font-medium transition-all
                                      ${shouldBeGrey
                                      ? 'text-slate-300 dark:text-slate-600'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  title={holiday ? `Holiday: ${holiday}` : (isNonWorking ? 'Non-working day' : '')}
                                >
                                  {date.getDate()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )) : (
                      <div className="p-12 text-center text-slate-400 dark:text-slate-500 italic">
                        No users found
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main >
    </div >
  );
}
