// src/pages/UserDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, ts } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
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
  const [fromDateStr, setFromDateStr] = useState("");
  const [toDateStr, setToDateStr] = useState("");
  const [partOfDay, setPartOfDay] = useState("Full Day"); // "Full Day" | "Morning" | "Evening"
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [reason, setReason] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(getMonday(new Date()));
  const [currentUserData, setCurrentUserData] = useState(null);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const LEAVE_CATEGORIES = {
    Holiday: { type: "Deductable", color: "bg-purple-500" },
    "Doctor Appointment": { type: "Deductable", color: "bg-cyan-500" },
    "Sick Leave": { type: "Non-Deductable", color: "bg-green-500" },
    Maternity: { type: "Non-Deductable", color: "bg-purple-600" },
    Paternity: { type: "Non-Deductable", color: "bg-purple-600" },
    Meeting: { type: "Non-Deductable", color: "bg-orange-500" },
    Compassionate: { type: "Non-Deductable", color: "bg-yellow-500" },
    "Public Holiday": { type: "Non-Deductable", color: "bg-amber-700" },
    "Festive Holiday": { type: "Non-Deductable", color: "bg-red-500" },
    "Working from Home": { type: "Non-Deductable", color: "bg-blue-900" },
  };

  useEffect(() => {
    loadUsers();
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const usersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);
      if (currentUserId) {
        setCurrentUserData(usersData.find(u => u.uid === currentUserId) || null);
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

  // Utilities
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0,0,0,0);
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
    setSelectedWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return new Date(d);
    });
  }

  // Derive week dates from selectedWeek
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + i);
    d.setHours(0,0,0,0);
    return d;
  });

  // Determine if a single-day selection implies half day
  function determineHalfForSelection(startDateStr, endDateStr, part) {
    if (!startDateStr || !endDateStr) return { isHalfDay: false, halfType: null };
    if (startDateStr !== endDateStr) return { isHalfDay: false, halfType: null };
    if (part === "Morning") return { isHalfDay: true, halfType: "Morning" };
    if (part === "Evening") return { isHalfDay: true, halfType: "Evening" };
    return { isHalfDay: false, halfType: null };
  }

  // Calculate leave balance
  function getLeaveBalance() {
    if (!currentUserData) return { total: 0, used: 0, remaining: 0 };
    const total = currentUserData.leaveDaysAssigned || 0;

    const used = leaves
      .filter(l => {
        return l.userId === currentUserId &&
          l.status === "Approved" &&
          LEAVE_CATEGORIES[l.category]?.type === "Deductable";
      })
      .reduce((sum, l) => {
        // Prefer stored daysCount, else compute fallback
        if (typeof l.daysCount === "number") return sum + l.daysCount;
        // fallback compute
        try {
          const s = new Date(l.from);
          const e = new Date(l.to);
          const sameDay = s.toDateString() === e.toDateString();
          if (l.isHalfDay || sameDay && l.isHalfDay) return sum + 0.5;
          const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
          return sum + days;
        } catch {
          return sum;
        }
      }, 0);

    return { total, used, remaining: Math.max(0, total - used) };
  }

  // Book leave handler
  async function bookLeave() {
    try {
      if (!currentUserId) return alert("User not logged in. Please log in.");
      if (!fromDateStr || !toDateStr) return alert("Select from and to dates");

      // normalize date objects
      const fromDate = dateFromDateString(fromDateStr);
      const toDate = dateFromDateString(toDateStr);

      if (!fromDate || !toDate) return alert("Invalid dates");
      if (toDate < fromDate) return alert("To date cannot be before From date");

      // Determine half-day and halfType based on selection and single-day case
      const { isHalfDay, halfType } = determineHalfForSelection(fromDateStr, toDateStr, partOfDay);

      // daysCount: if half-day => 0.5 else full days between inclusive
      const daysCount = isHalfDay ? 0.5 : Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

      // Build actual from/to datetimes stored: for completeness we set times depending on full/morning/evening
      let storedFrom = new Date(fromDate);
      let storedTo = new Date(toDate);
      if (isHalfDay) {
        if (halfType === "Morning") {
          storedFrom.setHours(9, 0, 0, 0);
          storedTo.setHours(13, 0, 0, 0);
        } else if (halfType === "Evening") {
          storedFrom.setHours(13, 0, 0, 0);
          storedTo.setHours(17, 0, 0, 0);
        }
      } else {
        // Full days: from 09:00 of start to 17:00 of end
        storedFrom.setHours(9, 0, 0, 0);
        storedTo.setHours(17, 0, 0, 0);
      }

      const leave = {
        userId: currentUserId,
        userName: currentUserData?.name || "Unknown",
        from: storedFrom.toISOString(),
        to: storedTo.toISOString(),
        fromDateOnly: fromDateStr,
        toDateOnly: toDateStr,
        isHalfDay,
        halfType: isHalfDay ? halfType : null,
        daysCount,
        category: leaveCategory,
        type: LEAVE_CATEGORIES[leaveCategory]?.type || "Deductable",
        reason,
        status: "Pending",
        createdAt: ts(),
      };

      await addDoc(collection(db, "leaveRequests"), leave);
      alert("Leave request submitted");
      // reset
      setFromDateStr("");
      setToDateStr("");
      setPartOfDay("Full Day");
      setLeaveCategory("Holiday");
      setReason("");
      // reload
      loadLeaves();
    } catch (err) {
      console.error("Error booking leave:", err);
      alert("Error submitting leave");
    }
  }

  // Helpers for rendering / matching leaves to a date cell
  function parseStoredDate(s) {
    try {
      return new Date(s);
    } catch {
      return null;
    }
  }

  function isLeaveOnDate(leave, date) {
    // date is a Date with midnight time
    // compare using stored fromDateOnly/toDateOnly if present
    if (leave.fromDateOnly && leave.toDateOnly) {
      const start = new Date(leave.fromDateOnly + "T00:00:00");
      const end = new Date(leave.toDateOnly + "T00:00:00");
      return start <= date && end >= date;
    }
    const s = parseStoredDate(leave.from);
    const e = parseStoredDate(leave.to);
    if (!s || !e) return false;
    // Normalize
    const sd = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const ed = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    return sd <= date && ed >= date;
  }

  function getCategoryColor(category) {
    return LEAVE_CATEGORIES[category]?.color || "bg-slate-500";
  }

  // Render
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
              <label className="text-xs text-slate-400 ml-1">From (date)</label>
              <input
                type="date"
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={fromDateStr}
                onChange={e => setFromDateStr(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">To (date)</label>
              <input
                type="date"
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={toDateStr}
                onChange={e => setToDateStr(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Part of day (single-day only)</label>
              <select
                className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={partOfDay}
                onChange={e => setPartOfDay(e.target.value)}
              >
                <option>Full Day</option>
                <option>Morning</option>
                <option>Evening</option>
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
            <div className="w-full sm:w-auto flex gap-2">
              <select
                className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                value={leaveCategory}
                onChange={e => setLeaveCategory(e.target.value)}
              >
                {Object.keys(LEAVE_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat} ({LEAVE_CATEGORIES[cat].type})</option>
                ))}
              </select>
              <button
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 sm:px-8 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20 w-full sm:w-auto"
                onClick={bookLeave}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>

        {/* Weekly Calendar */}
        <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-500/10 rounded-lg">
                <CalendarDaysIcon className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-heading font-semibold">Team Leave Calendar</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Week of {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
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

          {/* Legend */}
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

          {/* Calendar grid */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="px-4 sm:px-0">
              <div className="min-w-[800px]">
                {/* header */}
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

                {/* user rows */}
                {users.length > 0 ? users.map(user => (
                  <div key={user.id} className="grid grid-cols-8 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    {/* user info */}
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

                    {/* day cells */}
                    {weekDates.map((date, dayIdx) => {
                      // find leaves for this user on this date
                      const userLeavesOnDay = leaves.filter(l => l.userId === user.uid && isLeaveOnDate(l, date));

                      return (
                        <div key={dayIdx} className="p-2 border-r border-white/5 last:border-r-0 min-h-[80px]">
                          {userLeavesOnDay.length > 0 ? (
                            <div className="space-y-1">
                              {userLeavesOnDay.map(leave => {
                                const bgClass = getCategoryColor(leave.category);
                                const isHalf = !!leave.isHalfDay;
                                const halfType = leave.halfType || null;

                                // if half-day and the date is the start date (or single-day record), show half-block
                                const startDateOnly = leave.fromDateOnly || (() => {
                                  const f = parseStoredDate(leave.from);
                                  return f ? `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}` : null;
                                })();

                                const endDateOnly = leave.toDateOnly || (() => {
                                  const e = parseStoredDate(leave.to);
                                  return e ? `${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,'0')}-${String(e.getDate()).padStart(2,'0')}` : null;
                                })();

                                const cellDateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

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
                                            <div className={`w-1/2 rounded-r-md p-2 text-center hover:scale-105 transition-transform cursor-pointer ${bgClass}`}
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
                                        className={`${bgClass} rounded-md p-2 text-center hover:scale-105 transition-transform cursor-pointer`}
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
                              <div className="w-1 h-1 rounded-full bg-slate-700/50"></div>
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
    </div>
  );
}
