// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, ts } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { LEAVE_CATEGORIES } from "../config/leaveCategories"; // Shared categories
import {
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon
} from "@heroicons/react/24/outline";

export default function UserDashboard() {
  const auth = getAuth();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;

  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [timePeriod, setTimePeriod] = useState("Full Day"); // New state
  const [reason, setReason] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [currentUserData, setCurrentUserData] = useState(null);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // REMOVED: Local LEAVE_CATEGORIES definition

  useEffect(() => {
    loadUsers();
    loadLeaves();
  }, []);

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);

      // Find current user data
      if (currentUserId) {
        const userData = usersData.find(u => u.uid === currentUserId);
        setCurrentUserData(userData);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }

  async function loadLeaves() {
    try {
      const snapshot = await getDocs(collection(db, "leaveRequests"));
      setLeaves(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading leaves:", error);
    }
  }

  // Calculate leave balance for current user
  function getLeaveBalance() {
    if (!currentUserData) return { total: 0, used: 0, remaining: 0 };

    const total = currentUserData.leaveDaysAssigned || 0;
    const used = leaves
      .filter(l => {
        const categoryInfo = LEAVE_CATEGORIES[l.category];
        return l.userId === currentUserId &&
          l.status === "Approved" &&
          categoryInfo?.type === "Deductable";
      })
      .reduce((sum, l) => {
        const fromDate = new Date(l.from);
        const toDate = new Date(l.to);
        const days = Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1; // Approx days
        // Note: This logic might need refinement if we have complex timestamps now.
        // But for now, if isHalfDay is true, add 0.5, else add diff days.
        return sum + (l.isHalfDay ? 0.5 : days);
      }, 0);

    return { total, used, remaining: total - used };
  }

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function getWeekDates(start) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  function prevWeek() {
    setSelectedWeek(new Date(selectedWeek.setDate(selectedWeek.getDate() - 7)));
  }

  function nextWeek() {
    setSelectedWeek(new Date(selectedWeek.setDate(selectedWeek.getDate() + 7)));
  }

  function bookLeave() {
    if (!currentUserId) return alert("User not found, login again.");
    if (!from || !to) return alert("Select leave dates");

    // Calculate actual datetime strings based on Time Period logic
    let fromDate = new Date(from);
    let toDate = new Date(to);

    if (timePeriod === "Morning") {
      fromDate.setHours(9, 0, 0, 0);
      toDate.setHours(13, 0, 0, 0);
    } else if (timePeriod === "Afternoon") {
      fromDate.setHours(13, 0, 0, 0);
      toDate.setHours(17, 0, 0, 0);
    } else {
      // Full Day
      fromDate.setHours(9, 0, 0, 0);
      toDate.setHours(17, 0, 0, 0);
    }

    const categoryInfo = LEAVE_CATEGORIES[leaveCategory];
    const isHalfDay = timePeriod !== "Full Day";

    const formatDateTime = (date) => {
      const pad = (num) => num.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const leave = {
      userId: currentUserId,
      userName: users.find(u => u.uid === currentUserId)?.name || "Unknown User",
      from: formatDateTime(fromDate),
      to: formatDateTime(toDate),
      type: categoryInfo.type,
      category: leaveCategory,
      reason,
      isHalfDay,
      status: "Pending",
      createdAt: ts()
    };

    addDoc(collection(db, "leaveRequests"), leave)
      .then(() => {
        alert("Leave request submitted");
        setFrom(""); setTo(""); setReason("");
        setLeaveCategory("Holiday");
        setTimePeriod("Full Day");
        loadLeaves();
      });
  }

  const weekDates = getWeekDates(selectedWeek);

  // Get color based on leave category
  const getCategoryColor = (category) => {
    return LEAVE_CATEGORIES[category]?.color || 'bg-slate-500';
  };

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text font-sans">
      {/* Header */}
      <header className="bg-dark-card border-b border-white/5 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md bg-dark-card/80">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-heading font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
          User Dashboard
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              {currentUserData?.photoURL ? (
                <img src={currentUserData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-medium text-xs sm:text-sm">{currentUserData?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-white">{currentUserData?.name || 'User'}</div>
              <div className="text-xs text-slate-400">View Profile</div>
            </div>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-2 sm:px-4 py-2 rounded-lg hover:bg-white/5"
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

        {/* Leave Booking Card */}
        <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <PlusCircleIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-semibold">Request Leave</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">From</label>
              <input
                type="date"
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={from}
                onChange={e => {
                  setFrom(e.target.value);
                  if (!to) setTo(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">To</label>
              <input
                type="date"
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Category</label>
              <select
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={leaveCategory}
                onChange={e => setLeaveCategory(e.target.value)}
              >
                {Object.keys(LEAVE_CATEGORIES).map(category => (
                  <option key={category} value={category}>
                    {category} ({LEAVE_CATEGORIES[category].type})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Time Period</label>
              <select
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
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
              className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
              placeholder="Reason for leave..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            {/* REMOVED: Half Day Checkbox - Now replaced by Time Period Select */}
            <button
              className="bg-primary-600 hover:bg-primary-500 text-white px-6 sm:px-8 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20 w-full sm:w-auto"
              onClick={bookLeave}
            >
              Submit Request
            </button>
          </div>
        </div>

        {/* Weekly Calendar - Grid Layout */}
        <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-500/10 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-semibold">Team Leave Calendar</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Week of {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
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

          {/* Category Legend */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-dark-bg/30">
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <span className="text-xs text-slate-400 font-medium mr-2">Leave Types:</span>
              {Object.entries(LEAVE_CATEGORIES).map(([category, info]) => (
                <div key={category} className="flex items-center gap-1.5 sm:gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${info.color}`}></div>
                  <span className="text-[10px] sm:text-xs text-slate-300">{category}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="px-4 sm:px-0">
              <div className="min-w-[800px]">
                {/* Header Row - Days of the Week */}
                <div className="grid grid-cols-8 border-b border-white/5 bg-dark-bg/30">
                  <div className="p-4 border-r border-white/5">
                    <span className="text-xs text-slate-400 font-medium uppercase">Team Member</span>
                  </div>
                  {weekDates.map((date, idx) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div key={idx} className="p-4 text-center border-r border-white/5 last:border-r-0">
                        <div className="text-xs text-slate-400 uppercase font-medium mb-1">{DAYS[idx]}</div>
                        <div className={`text-lg font-bold ${isToday ? 'text-primary-400' : 'text-white'}`}>
                          {date.getDate()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* User Rows */}
                {users.length > 0 ? (
                  users.map((user) => (
                    <div key={user.id} className="grid grid-cols-8 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      {/* User Info Cell */}
                      <div className="p-4 border-r border-white/5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center flex-shrink-0">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-medium text-sm">{user.name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{user.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-400 truncate">{user.email || ''}</div>
                        </div>
                      </div>

                      {/* Day Cells for this User */}
                      {weekDates.map((date, dayIdx) => {
                        // Find leaves for this user on this specific date
                        const userLeavesOnDay = leaves.filter(l => {
                          const lStart = new Date(l.from);
                          const lEnd = new Date(l.to);
                          return l.userId === user.uid && lStart <= date && lEnd >= date;
                        });

                        return (
                          <div key={dayIdx} className="p-2 border-r border-white/5 last:border-r-0 min-h-[80px]">
                            {userLeavesOnDay.length > 0 ? (
                              <div className="space-y-1">
                                {userLeavesOnDay.map(leave => {
                                  const bgClass = getCategoryColor(leave.category);
                                  return (
                                    <div
                                      key={leave.id}
                                      className={`${bgClass} rounded-md p-2 text-center hover:scale-105 transition-transform cursor-pointer`}
                                      title={`${leave.category}${leave.isHalfDay ? ' (Half Day)' : ''}\n${leave.reason || ''}\nStatus: ${leave.status}`}
                                    >
                                      <div className="text-[10px] text-white/90 font-medium truncate">
                                        {leave.category}
                                      </div>
                                      {leave.isHalfDay && (
                                        <div className="text-[9px] text-white/70">Half Day</div>
                                      )}
                                      <div className={`text-[9px] mt-1 px-1 py-0.5 rounded ${leave.status === 'Approved' ? 'bg-green-500/30 text-green-200' :
                                        leave.status === 'Rejected' ? 'bg-red-500/30 text-red-200' :
                                          'bg-yellow-500/30 text-yellow-200'
                                        }`}>
                                        {leave.status}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center">
                                <div className="w-1 h-1 rounded-full bg-slate-700/50"></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    No team members found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
