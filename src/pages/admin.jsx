// src/pages/Admin.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db, ts, secondaryAuth } from "../firebase/firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import toast, { Toaster } from "react-hot-toast";
import {
  UsersIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  BellIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("usersOrgs");

  // Users & Orgs
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");

  // Create User
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");

  // Create Org
  const [newOrg, setNewOrg] = useState("");

  // Leave Management
  const [leaveDays, setLeaveDays] = useState("");
  const [workingDays, setWorkingDays] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [leaveType, setLeaveType] = useState("Deductable");
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [reason, setReason] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // ----- Load data -----
  useEffect(() => {
    loadUsers();
    loadOrgs();
    loadLeaves();
    loadNotifications();
  }, []);

  async function loadUsers() {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error("Failed to load users");
    }
  }

  async function loadOrgs() {
    try {
      const snapshot = await getDocs(collection(db, "organizations"));
      setOrgs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error("Failed to load organizations");
    }
  }

  async function loadLeaves() {
    try {
      const snapshot = await getDocs(collection(db, "leaveRequests"));
      setLeaveRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error("Failed to load leave requests");
    }
  }

  async function loadNotifications() {
    try {
      const snapshot = await getDocs(collection(db, "notifications"));
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error("Failed to load notifications");
    }
  }

  // ----- Helpers -----
  function getRemainingLeaves(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return 0;
    const usedLeaves = leaveRequests
      .filter(l => l.userId === userId && l.status === "Approved" && l.type === "Deductable")
      .reduce((sum, l) => {
        const fromDate = new Date(l.from);
        const toDate = new Date(l.to);
        return sum + (Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1);
      }, 0);
    return (user.leaveDaysAssigned || 0) - usedLeaves;
  }

  async function clearLeaveRequests() {
    if (!window.confirm("Are you sure you want to delete all leave requests?")) return;
    try {
      const snapshot = await getDocs(collection(db, "leaveRequests"));
      const batch = snapshot.docs.map(docItem => deleteDoc(doc(db, "leaveRequests", docItem.id)));
      await Promise.all(batch);
      toast.success("All leave requests cleared");
      loadLeaves();
    } catch (error) {
      toast.error("Error clearing leave requests: " + error.message);
    }
  }

  function toggleDay(day) {
    setWorkingDays(w => w.includes(day) ? w.filter(d => d !== day) : [...w, day]);
  }

  // ----- User Management -----
  async function createUser() {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      return toast.error("Please fill all fields");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      return toast.error("Please enter a valid email address");
    }

    // Validate password length (Firebase requires minimum 6 characters)
    if (newUserPassword.length < 6) {
      return toast.error("Password must be at least 6 characters long");
    }

    // Validate name
    if (newUserName.trim().length < 2) {
      return toast.error("Name must be at least 2 characters long");
    }

    try {
      // Create user account using SECONDARY auth instance
      // This prevents the admin from being logged out!
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,  // Use secondary auth instead of main auth
        newUserEmail,
        newUserPassword
      );

      // Create user document in Firestore
      const docRef = await addDoc(collection(db, "users"), {
        uid: cred.user.uid,
        name: newUserName.trim().charAt(0).toUpperCase() + newUserName.trim().slice(1).toLowerCase(),
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        leaveDaysAssigned: 0,
        workingDays: [],
        organizationName: "",
        photoURL: "",
        createdAt: ts(),
      });

      // Update local state
      setUsers(prev => [...prev, {
        id: docRef.id,
        uid: cred.user.uid,
        name: newUserName.trim().charAt(0).toUpperCase() + newUserName.trim().slice(1).toLowerCase(),
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        leaveDaysAssigned: 0,
        workingDays: [],
        organizationName: "",
        photoURL: ""
      }]);

      // Clear form
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("user");

      toast.success(`User ${newUserEmail} created successfully!`);

      // Sign out from secondary auth to clean up
      await signOut(secondaryAuth);

    } catch (error) {
      console.error("User creation error:", error);

      // Provide specific error messages
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already registered");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address");
      } else if (error.code === "auth/weak-password") {
        toast.error("Password is too weak. Use at least 6 characters");
      } else if (error.code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later");
      } else {
        toast.error(`Failed to create user: ${error.message || "Unknown error"}`);
      }
    }
  }

  async function deleteUser(uid) {
    if (!window.confirm("Delete user?")) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      setUsers(prev => prev.filter(u => u.id !== uid));
      toast.success("User deleted");
    } catch {
      toast.error("Failed to delete user");
    }
  }

  // ----- Organization -----
  async function createOrg() {
    if (!newOrg) return toast.error("Enter org name");
    try {
      const docRef = await addDoc(collection(db, "organizations"), { name: newOrg, createdAt: ts() });
      setOrgs(prev => [...prev, { id: docRef.id, name: newOrg }]);
      setNewOrg("");
      toast.success("Organization created");
    } catch {
      toast.error("Failed to create org");
    }
  }

  async function assignUserToOrg() {
    if (!selectedUser || !selectedOrg) return toast.error("Select user & org");
    try {
      await updateDoc(doc(db, "users", selectedUser), { organizationName: selectedOrg });
      setUsers(prev => prev.map(u => u.id === selectedUser ? { ...u, organizationName: selectedOrg } : u));
      toast.success("User assigned to org");
    } catch {
      toast.error("Failed to assign user");
    }
  }

  // ----- Leave Days -----
  async function saveLeaveDays() {
    if (!selectedUser) return toast.error("Select user");
    try {
      await updateDoc(doc(db, "users", selectedUser), { leaveDaysAssigned: Number(leaveDays) });
      setUsers(prev => prev.map(u => u.id === selectedUser ? { ...u, leaveDaysAssigned: Number(leaveDays) } : u));
      setLeaveDays("");
      toast.success("Leave days updated");
    } catch {
      toast.error("Failed to update leave days");
    }
  }

  async function saveWorkingDays() {
    if (!selectedUser) return toast.error("Select user");
    try {
      await updateDoc(doc(db, "users", selectedUser), { workingDays });
      setUsers(prev => prev.map(u => u.id === selectedUser ? { ...u, workingDays } : u));
      setWorkingDays([]);
      toast.success("Working days saved");
    } catch {
      toast.error("Failed to save working days");
    }
  }

  // ----- Book Leave -----
  async function bookLeave() {
    if (!selectedUser || !from || !to) return toast.error("Select all fields");
    try {
      const leave = { userId: selectedUser, userName: users.find(u => u.id === selectedUser)?.name || "", from, to, type: leaveType, category: leaveCategory, reason, status: "Pending", createdAt: ts() };
      const docRef = await addDoc(collection(db, "leaveRequests"), leave);
      setLeaveRequests(prev => [...prev, { ...leave, id: docRef.id }]);
      await addDoc(collection(db, "notifications"), { type: "leave_request", message: `Leave requested for ${leave.userName}`, read: false, createdAt: ts(), meta: { userId: selectedUser } });
      setFrom(""); setTo(""); setReason(""); setLeaveType("Deductable"); setLeaveCategory("Holiday");
      toast.success("Leave booked");
    } catch {
      toast.error("Failed to book leave");
    }
  }

  async function setLeaveStatus(id, status) {
    try {
      await updateDoc(doc(db, "leaveRequests", id), { status, reviewedAt: ts() });
      setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      toast.success(`Leave ${status.toLowerCase()}`);
    } catch {
      toast.error("Failed to update leave status");
    }
  }

  async function markRead(id) {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      toast.success("Notification marked read");
    } catch {
      toast.error("Failed to mark read");
    }
  }

  const remainingLeaves = selectedUser ? getRemainingLeaves(selectedUser) : "-";

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${tab === id
        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-dark-bg text-dark-text overflow-hidden font-sans">
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e293b',
          color: '#fff',
        }
      }} />

      {/* Sidebar */}
      <aside className="w-64 bg-dark-card border-r border-white/5 p-6 flex flex-col">
        <div className="mb-8 px-2">
          <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
            Admin Panel
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem id="usersOrgs" icon={UsersIcon} label="Users & Organizations" />
          <SidebarItem id="leaveMgmt" icon={CalendarDaysIcon} label="Leave Management" />
          <SidebarItem id="notificationsTab" icon={BellIcon} label="Notifications" />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto animate-fade-in">

          {/* Users & Orgs Tab */}
          {tab === "usersOrgs" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create User Card */}
                <div className="bg-dark-card border border-white/5 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-xl font-heading font-semibold mb-6 flex items-center gap-2">
                    <PlusIcon className="h-5 w-5 text-primary-400" />
                    Create New User
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="Full Name"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                      />
                      <input
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="Email Address"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="Password"
                        type="password"
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                      />
                      <select
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <button
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20"
                      onClick={createUser}
                    >
                      Create User
                    </button>
                  </div>
                </div>

                {/* Create Org Card */}
                <div className="bg-dark-card border border-white/5 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-xl font-heading font-semibold mb-6 flex items-center gap-2">
                    <BuildingOfficeIcon className="h-5 w-5 text-secondary-400" />
                    Organization Management
                  </h2>
                  <div className="space-y-6">
                    <div className="flex gap-3">
                      <input
                        className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all"
                        placeholder="Organization Name"
                        value={newOrg}
                        onChange={e => setNewOrg(e.target.value)}
                      />
                      <button
                        className="bg-secondary-600 hover:bg-secondary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-secondary-600/20"
                        onClick={createOrg}
                      >
                        Add
                      </button>
                    </div>

                    <div className="border-t border-white/5 pt-6">
                      <h3 className="text-sm font-medium text-slate-400 mb-4">Assign User to Organization</h3>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all"
                          value={selectedUser}
                          onChange={e => setSelectedUser(e.target.value)}
                        >
                          <option value="">Select User</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <select
                          className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all"
                          value={selectedOrg}
                          onChange={e => setSelectedOrg(e.target.value)}
                        >
                          <option value="">Select Org</option>
                          {orgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                        </select>
                        <button
                          className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                          onClick={assignUserToOrg}
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h2 className="text-xl font-heading font-semibold">User Directory</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-slate-400 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">Name</th>
                        <th className="px-6 py-4 font-medium">Email</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium">Organization</th>
                        <th className="px-6 py-4 font-medium text-center">Leave Balance</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-medium">{u.name || "-"}</td>
                          <td className="px-6 py-4 text-slate-400">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{u.organizationName || "-"}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-emerald-400 font-bold">{getRemainingLeaves(u.id)}</span>
                            <span className="text-slate-500 text-xs ml-1">/ {u.leaveDaysAssigned || 0}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-all"
                              onClick={() => deleteUser(u.id)}
                              title="Delete User"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Leave Management Tab */}
          {tab === "leaveMgmt" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Card */}
                <div className="bg-dark-card border border-white/5 p-6 rounded-2xl shadow-xl space-y-8">
                  <div>
                    <h2 className="text-xl font-heading font-semibold mb-6">Leave Allocation</h2>
                    <div className="flex gap-3">
                      <select
                        className="flex-1 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <input
                        className="w-24 bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="Days"
                        value={leaveDays}
                        onChange={e => setLeaveDays(e.target.value)}
                      />
                      <button
                        className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                        onClick={saveLeaveDays}
                      >
                        Save
                      </button>
                    </div>
                    {selectedUser && (
                      <div className="mt-4 p-4 bg-white/5 rounded-lg flex justify-between items-center">
                        <span className="text-slate-400">Current Balance</span>
                        <span className="text-xl font-bold text-emerald-400">{remainingLeaves} Days</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-8">
                    <h2 className="text-xl font-heading font-semibold mb-6">Working Days</h2>
                    <div className="flex flex-wrap gap-3 mb-6">
                      {WEEK.map(day => (
                        <label key={day} className={`
                          cursor-pointer px-3 py-2 rounded-lg border transition-all select-none
                          ${workingDays.includes(day)
                            ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                            : 'bg-dark-bg border-white/10 text-slate-400 hover:border-white/30'}
                        `}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={workingDays.includes(day)}
                            onChange={() => toggleDay(day)}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                    <button
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-medium transition-colors"
                      onClick={saveWorkingDays}
                    >
                      Update Schedule
                    </button>
                  </div>
                </div>

                {/* Book Leave Card */}
                <div className="bg-dark-card border border-white/5 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-xl font-heading font-semibold mb-6">Book Leave</h2>
                  <div className="space-y-4">
                    <select
                      className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                      value={selectedUser}
                      onChange={e => setSelectedUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 ml-1">From</label>
                        <input
                          type="date"
                          className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          value={from}
                          onChange={e => setFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 ml-1">To</label>
                        <input
                          type="date"
                          className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                          value={to}
                          onChange={e => setTo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <select
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        value={leaveType}
                        onChange={e => setLeaveType(e.target.value)}
                      >
                        <option value="Deductable">Deductable</option>
                        <option value="Non-deductable">Non-deductable</option>
                      </select>
                      <select
                        className="bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        value={leaveCategory}
                        onChange={e => setLeaveCategory(e.target.value)}
                      >
                        <option value="Holiday">Holiday</option>
                        <option value="Sick">Sick</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <textarea
                      className="w-full bg-dark-bg border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all h-24 resize-none"
                      placeholder="Reason for leave..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                    />

                    <button
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20"
                      onClick={bookLeave}
                    >
                      Submit Request
                    </button>
                  </div>
                </div>
              </div>

              {/* Requests Table */}
              <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <h2 className="text-xl font-heading font-semibold">Leave Requests</h2>
                  <button
                    className="text-red-400 hover:text-red-300 text-sm font-medium hover:underline"
                    onClick={clearLeaveRequests}
                  >
                    Clear History
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-slate-400 text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">User</th>
                        <th className="px-6 py-4 font-medium">Dates</th>
                        <th className="px-6 py-4 font-medium">Details</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaveRequests.map(l => (
                        <tr key={l.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-medium">{l.userName}</td>
                          <td className="px-6 py-4 text-slate-400">
                            <div className="flex flex-col text-sm">
                              <span>{l.from}</span>
                              <span className="text-slate-600">to</span>
                              <span>{l.to}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">{l.category}</span>
                              <span className="text-xs text-slate-500">{l.type}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${l.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' :
                              l.status === 'Rejected' ? 'bg-red-500/20 text-red-300' :
                                'bg-amber-500/20 text-amber-300'
                              }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {l.status === "Pending" && (
                              <div className="flex justify-end gap-2">
                                <button
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  onClick={() => setLeaveStatus(l.id, "Approved")}
                                  title="Approve"
                                >
                                  <CheckCircleIcon className="h-6 w-6" />
                                </button>
                                <button
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  onClick={() => setLeaveStatus(l.id, "Rejected")}
                                  title="Reject"
                                >
                                  <XCircleIcon className="h-6 w-6" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {tab === "notificationsTab" && (
            <div className="bg-dark-card border border-white/5 rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-heading font-semibold">Notifications</h2>
              </div>
              <ul className="divide-y divide-white/5">
                {notifications.length === 0 && (
                  <li className="p-8 text-center text-slate-500">No notifications yet</li>
                )}
                {notifications.map(n => (
                  <li key={n.id} className={`p-6 transition-colors ${n.read ? 'bg-transparent' : 'bg-primary-500/5'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full ${n.read ? 'bg-slate-600' : 'bg-primary-500'}`} />
                        <p className={`${n.read ? 'text-slate-400' : 'text-white font-medium'}`}>
                          {n.message}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          className="text-xs font-medium text-primary-400 hover:text-primary-300 whitespace-nowrap"
                          onClick={() => markRead(n.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
