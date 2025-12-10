// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, ts } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { LEAVE_CATEGORIES } from "../context/leavetypes"; // Shared categories
import toast, { Toaster } from "react-hot-toast";
import {
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon
} from "@heroicons/react/24/outline";
import ThemeToggle from "../components/ThemeToggle";
import { sendNewLeaveRequestEmail, sendLeaveStatusEmail } from "../services/emailService";

export default function UserDashboard() {
  const auth = getAuth();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;

  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [timePeriod, setTimePeriod] = useState("Full Day"); // "Full Day" | "Morning" | "Afternoon"
  const [selectedLeaveType, setSelectedLeaveType] = useState("Deductable");
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [reason, setReason] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [currentUserData, setCurrentUserData] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Simple hardcoded holidays for demo purposes
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    loadHolidays();
  }, []);

  async function loadHolidays() {
    try {
      const snapshot = await getDocs(collection(db, "publicHolidays"));
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



  useEffect(() => {
    loadUsers();
    loadLeaves();
  }, []);

  // Update filtered category when type changes
  useEffect(() => {
    const validCategories = Object.keys(LEAVE_CATEGORIES).filter(cat => LEAVE_CATEGORIES[cat].type === selectedLeaveType);
    if (validCategories.length > 0 && (!LEAVE_CATEGORIES[leaveCategory] || LEAVE_CATEGORIES[leaveCategory].type !== selectedLeaveType)) {
      setLeaveCategory(validCategories[0]);
    }
  }, [selectedLeaveType]);

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);
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
      const snapshot = await getDocs(collection(db, "leaveRequests"));
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeaves(docs);
    } catch (err) {
      console.error("Error loading leaves:", err);
    }
  }

  // Calculate leave balance for current user
  function getLeaveBalance() {
    if (!currentUserData) return { total: 0, used: 0, remaining: 0 };

    const total = currentUserData.leaveDaysAssigned || 0;
    const used = leaves
      .filter(l => {
        const categoryInfo = LEAVE_CATEGORIES[l.category];
        // FIX: Match by Firestore ID (l.userId) against current user's Firestore ID (currentUserData.id)
        return l.userId === currentUserData.id &&
          l.status === "Approved" &&
          categoryInfo?.type === "Deductable";
      })
      .reduce((sum, l) => {
        const fromDate = new Date(l.from);
        const toDate = new Date(l.to);
        const days = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
        // If it's a half day, count as 0.5, otherwise count full days
        return sum + (l.isHalfDay ? 0.5 : days);
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

  function bookLeave() {
    if (!currentUserId) return toast.error("User not found, login again.");
    if (!fromDateStr || !toDateStr) return toast.error("Select leave dates");

    const categoryInfo = LEAVE_CATEGORIES[leaveCategory];
    const isHalfDay = timePeriod !== "Full Day";

    if (!currentUserData?.id) return toast.error("User profile not found. Please contact admin.");

    // Calculate requested duration
    const start = new Date(fromDateStr);
    const end = new Date(toDateStr);
    const dayDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const requestedDays = isHalfDay ? 0.5 : dayDiff;

    // Get current balance
    const { total, used } = getLeaveBalance();

    // Calculate pending usage to prevent overbooking
    const pendingUsage = leaves
      .filter(l => {
        const cat = LEAVE_CATEGORIES[l.category];
        return l.userId === currentUserData.id &&
          l.status === "Pending" &&
          cat?.type === "Deductable";
      })
      .reduce((sum, l) => {
        const pStart = new Date(l.from);
        const pEnd = new Date(l.to);
        const pDayDiff = Math.floor((pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
        return sum + (l.isHalfDay ? 0.5 : pDayDiff);
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
      from: fromDateStr,
      to: toDateStr,
      type: categoryInfo.type,
      category: leaveCategory,
      reason,
      isHalfDay,
      halfType: isHalfDay ? timePeriod : null,
      status, // Pending or Rejected
      adminResponse: isAutoRejected ? adminResponse : null,
      createdAt: ts()
    };

    addDoc(collection(db, "leaveRequests"), leave)
      .then(async (docRef) => {
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

        // Send Email Notification to Admin (Only if NOT auto-rejected, usually admins don't need spam for auto-rejects, OR maybe they do? Let's send it so they know someone tried)
        // Actually, let's send it.
        const adminEmailResult = await sendNewLeaveRequestEmail(leaveWithId, leave.userName);
        if (!adminEmailResult.success) {
          console.warn("Failed to send admin email:", adminEmailResult.error);
        }

        // Send Confirmation/Rejection Email to User
        const userEmail = currentUserData?.email;
        if (userEmail) {
          // Pass the auto-rejection reason if applicable
          const userEmailResult = await sendLeaveStatusEmail(userEmail, leave.userName, status, leave, isAutoRejected ? adminResponse : "");
          if (!userEmailResult.success) {
            console.warn("Failed to send user confirmation email:", userEmailResult.error);
          }
        }

        loadLeaves();
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to submit leave request");
      });
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
              className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors hidden sm:block"
            >
              Switch to Admin View
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
            onClick={() => navigate('/login')}
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
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
              <input
                className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-slate-100"
                placeholder="Reason for leave..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <button
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 sm:px-8 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20 w-full sm:w-auto"
                onClick={bookLeave}
              >
                Submit Request
              </button>
            </div>
          </div>
        )}

        {/* Weekly Calendar */}
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-500/10 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-semibold text-slate-900 dark:text-white">Team Leave Calendar</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Week of {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                onClick={prevWeek}
                title="Previous Week"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
                onClick={nextWeek}
                title="Next Week"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-dark-bg/30">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-2">Leave Types:</span>
              {Object.entries(LEAVE_CATEGORIES).map(([category, info]) => (
                <div key={category} className="flex items-center gap-1.5 sm:gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${info.color}`}></div>
                  <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300">{category}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="px-4 sm:px-0">
              <div className="min-w-[900px]">
                {/* header */}
                <div className="grid grid-cols-[180px_repeat(7,1fr)] sm:grid-cols-[220px_repeat(7,1fr)] border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-dark-bg/30">
                  <div className="sticky left-0 z-20 p-4 border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-dark-card shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase whitespace-nowrap">Team Member</span>
                  </div>
                  {weekDates.map((date, idx) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    const holiday = getHoliday(date);
                    return (
                      <div key={idx} className={`p-2 sm:p-4 text-center border-r border-slate-200 dark:border-white/5 last:border-r-0 ${holiday ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase font-medium mb-1">{DAYS[idx]}</div>
                        <div className={`text-base sm:text-lg font-bold ${isToday ? 'text-primary-500 dark:text-primary-400' : 'text-slate-700 dark:text-white'}`}>
                          {date.getDate()}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        {holiday && (
                          <div className="mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300 truncate max-w-full" title={holiday}>
                              {holiday}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* user rows */}
                {users.length > 0 ? users.map(user => (
                  <div key={user.id} className="grid grid-cols-[180px_repeat(7,1fr)] sm:grid-cols-[220px_repeat(7,1fr)] border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    {/* user info */}
                    <div className="sticky left-0 z-10 p-4 border-r border-slate-200 dark:border-white/5 flex items-center gap-3 bg-white dark:bg-dark-card shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-medium text-sm">{user.name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700 dark:text-white truncate">{user.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email || ''}</div>
                      </div>
                    </div>

                    {/* day cells */}
                    {weekDates.map((date, dayIdx) => {
                      // find leaves for this user on this date
                      // FIX: Match by Firestore ID (l.userId) against user.id
                      const userLeavesOnDay = leaves.filter(l => l.userId === user.id && isLeaveOnDate(l, date) && l.status !== "Rejected" && l.status !== "Cancelled");
                      const holiday = getHoliday(date);

                      return (
                        <div key={dayIdx} className={`p-2 border-r border-slate-200 dark:border-white/5 last:border-r-0 min-h-[80px] ${holiday ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                          {userLeavesOnDay.length > 0 ? (
                            <div className="space-y-1">
                              {userLeavesOnDay.map(leave => {
                                const bgClass = getCategoryColor(leave.category);
                                const isHalf = !!leave.isHalfDay;
                                const halfType = leave.halfType || null;

                                // if half-day and the date is the start date (or single-day record), show half-block
                                const startDateOnly = leave.fromDateOnly || (() => {
                                  const f = parseStoredDate(leave.from);
                                  return f ? `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` : null;
                                })();

                                const endDateOnly = leave.toDateOnly || (() => {
                                  const e = parseStoredDate(leave.to);
                                  return e ? `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}` : null;
                                })();

                                const cellDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                                const shouldShowHalf = isHalf && startDateOnly && startDateOnly === cellDateStr;

                                return (
                                  <div key={leave.id} className="w-full h-auto">
                                    {shouldShowHalf ? (
                                      <div className="flex w-full">
                                        {/* Morning half => left aligned half width, rounded left */}
                                        {halfType === "Morning" ? (
                                          <div className={`w-1/2 rounded-l-md p-2 text-center hover:scale-105 transition-transform cursor-pointer ${bgClass}`}
                                            title={`${leave.category} (Morning Half)\n${leave.reason || ''}\nStatus: ${leave.status}`}>
                                            <div className="text-[10px] text-white/90 font-medium truncate">
                                              {leave.category}
                                            </div>
                                            <div className="text-[9px] text-white/70">Half Day - Morning</div>
                                            <div className={`text-[9px] mt-1 px-1 py-0.5 rounded
                                              ${leave.status === 'Approved' ? 'bg-green-500/30 text-green-200' :
                                                leave.status === 'Rejected' ? 'bg-red-500/30 text-red-200' :
                                                  'bg-yellow-500/30 text-yellow-200'}`}>
                                              {leave.status}
                                            </div>
                                          </div>
                                        ) : (
                                          // Evening half => right aligned half width, rounded right
                                          <div className="w-full flex justify-end">
                                            <div className={`w-1/2 rounded-r-md p-2 text-center hover:scale-105 transition-transform cursor-pointer ${bgClass} ${leave.status === 'Pending' ? 'opacity-60 border-dashed border-2' : ''}`}
                                              title={`${leave.category} (Evening Half)\n${leave.reason || ''}\nStatus: ${leave.status}`}>
                                              <div className="text-[10px] text-white/90 font-medium truncate">
                                                {leave.category}
                                              </div>
                                              <div className="text-[9px] text-white/70">Half Day - Evening</div>
                                              <div className={`text-[9px] mt-1 px-1 py-0.5 rounded
                                                ${leave.status === 'Approved' ? 'bg-green-500/30 text-green-200' :
                                                  leave.status === 'Rejected' ? 'bg-red-500/30 text-red-200' :
                                                    'bg-yellow-500/30 text-yellow-200'}`}>
                                                {leave.status}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      // full width block (or multi-day)
                                      <div
                                        className={`${bgClass} rounded-md p-2 text-center hover:scale-105 transition-transform cursor-pointer ${leave.status === 'Pending' ? 'opacity-60 border-dashed border-2' : ''}`}
                                        title={`${leave.category}${leave.isHalfDay ? ` (${leave.halfType} Half Day)` : ''}\n${leave.reason || ''}\nStatus: ${leave.status}`}
                                      >
                                        <div className="text-[10px] text-white/90 font-medium truncate">
                                          {leave.category} {leave.isHalfDay && `(${leave.halfType})`}
                                        </div>
                                        {leave.isHalfDay && <div className="text-[9px] text-white/70">Half Day</div>}
                                        <div className={`text-[9px] mt-1 px-1 py-0.5 rounded ${leave.status === 'Approved' ? 'bg-green-500/30 text-green-200' :
                                          leave.status === 'Rejected' ? 'bg-red-500/30 text-red-200' :
                                            'bg-yellow-500/30 text-yellow-200'}`}>
                                          {leave.status}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700/50"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-500">
                    No team members found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div >
  );
}
