// src/pages/Admin.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db, ts } from "../firebase/firebase";
import toast, { Toaster } from "react-hot-toast";
import { LEAVE_CATEGORIES } from "../context/leavetypes"; // Import shared categories
import { useOrganization } from "../context/OrganizationContext";
import {
  UsersIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  BellIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  GlobeAmericasIcon,
  ClipboardDocumentListIcon
} from "@heroicons/react/24/outline";
import { useNavigate, useSearchParams } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { sendLeaveStatusEmail, sendWelcomeEmail, sendInvitationEmail } from "../services/emailService";
import { EMAILJS_CONFIG } from "../config/emailConfig";
import { sendPushNotification } from "../services/notificationService";
import { calculateLeaveDuration, isNonWorkingDay } from "../utils/leaveCalculations";

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("usersOrgs");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);



  // Users & Orgs
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");

  // Create User
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");

  // Create Org
  const [newOrg, setNewOrg] = useState("");

  // Leave Management
  const [leaveDays, setLeaveDays] = useState("");
  const [workingDays, setWorkingDays] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timePeriod, setTimePeriod] = useState("Full Day"); // Demo for single day or legacy
  const [startHalfType, setStartHalfType] = useState("Full Day");
  const [endHalfType, setEndHalfType] = useState("Full Day");
  const [leaveType, setLeaveType] = useState("Deductable");
  const [leaveCategory, setLeaveCategory] = useState("Holiday");
  const [reason, setReason] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Invitations
  const [invitations, setInvitations] = useState([]); // If we want to list them, for now just create.

  // Year-End Reset
  const [transferRemainingDays, setTransferRemainingDays] = useState(false);
  const [newYearAllocation, setNewYearAllocation] = useState("");
  const [resetTargetUser, setResetTargetUser] = useState(""); // For individual reset
  const [individualAllocation, setIndividualAllocation] = useState("");
  const [individualTransfer, setIndividualTransfer] = useState(false);

  // Deep Link Action State
  const [actionModal, setActionModal] = useState(null); // { id, action, userDetails... }
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    if (action && id && leaveRequests.length > 0) {
      const request = leaveRequests.find(r => r.id === id);
      if (request && request.status === "Pending") {
        const user = users.find(u => u.id === request.userId);
        setActionModal({
          id,
          action,
          request,
          userName: user?.name || "Unknown User",
          userEmail: user?.email || ""
        });
      } else if (request) {
        toast.error(`Request already ${request.status}`);
        setSearchParams({}); // Clear params
      }
    }
  }, [searchParams, leaveRequests, users]);

  const confirmAction = async () => {
    if (!actionModal) return;
    const { id, action } = actionModal;

    // Normalize action string (Approved/Rejected -> Approved/Rejected)
    // Email sends "Approved" or "Rejected" usually, or capitalize
    const status = action === "Approved" ? "Approved" : action === "Rejected" ? "Rejected" : null;

    if (status) {
      // Pass reason only if rejected
      const reasonToSend = status === "Rejected" ? rejectionReason : "";

      await setLeaveStatus(id, status, reasonToSend);

      setActionModal(null);
      setRejectionReason(""); // Clear reason
      setSearchParams({}); // Clear URL
      toast.success(`Successfully ${status} request via Link`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to logout");
    }
  };

  // Organization Context
  const { org } = useOrganization();
  const orgId = org?.id;

  // SUPER ADMIN CHECK
  const isSuperAdmin = auth.currentUser?.email === "akmusajee53@gmail.com";

  // Super Admin Filter State
  const [filterOrgId, setFilterOrgId] = useState("ALL");

  // ----- Load data -----
  useEffect(() => {
    // Load data if we have an Org ID OR if we are Super Admin
    if (orgId || isSuperAdmin) {
      loadOrgs();
      loadUsers();
      loadLeaves();
      loadNotifications();
      loadHolidays();
    }
  }, [orgId, isSuperAdmin, filterOrgId]); // Reload when filter changes

  // Auto-update leave type when category changes
  useEffect(() => {
    const validCategories = Object.keys(LEAVE_CATEGORIES).filter(cat => LEAVE_CATEGORIES[cat].type === leaveType);
    if (validCategories.length > 0 && (!LEAVE_CATEGORIES[leaveCategory] || LEAVE_CATEGORIES[leaveCategory].type !== leaveType)) {
      setLeaveCategory(validCategories[0]);
    }
  }, [leaveType]);

  // Sync working days when user is selected
  useEffect(() => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser);
      // Default to empty array if undefined
      setWorkingDays(user?.workingDays || []);
    } else {
      setWorkingDays([]);
    }
  }, [selectedUser, users]);

  async function loadUsers() {
    try {
      let q;
      if (isSuperAdmin) {
        if (filterOrgId !== "ALL") {
          q = query(collection(db, "users"), where("orgId", "==", filterOrgId));
        } else {
          q = query(collection(db, "users")); // Fetch ALL users
        }
      } else {
        q = query(collection(db, "users"), where("orgId", "==", orgId));
      }

      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    }
  }

  async function loadOrgs() {
    try {
      if (isSuperAdmin) {
        const snapshot = await getDocs(collection(db, "organizations"));
        setOrgs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else if (org) {
        setOrgs([org]);
      }
    } catch (e) {
      console.error("Failed to load orgs", e);
    }
  }

  async function loadLeaves() {
    try {
      let q;
      // Ideally we should have orgId on leaves. For now, if Super Admin, fetch all.
      // If we filtered by Org, we need to filter client side if orgId is missing on older docs,
      // or use where() if we added orgId to leaves. We did add orgId in bookLeave!

      if (isSuperAdmin) {
        if (filterOrgId !== "ALL") {
          q = query(collection(db, "leaveRequests"), where("orgId", "==", filterOrgId));
        } else {
          q = collection(db, "leaveRequests");
        }
      } else {
        q = query(collection(db, "leaveRequests"), where("orgId", "==", orgId));
      }

      const snapshot = await getDocs(q);
      setLeaveRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); // Fix: variable name was leaveRequests, function calls it leaveRequests
    } catch (e) {
      console.error("Failed to load leaves", e);
      // toast.error("Failed to load leave requests");
    }
  }

  // Wrapper for setLeaveRequests to match variable name above if needed, 
  // but better to just fix the load function to set the state directly.
  // Re-writing loadLeaves to strictly match state variable:

  /* RE-IMPLEMENTING loadLeaves CORRECTLY */

  async function loadNotifications() {
    try {
      if (isSuperAdmin && filterOrgId === "ALL") {
        const snapshot = await getDocs(collection(db, "notifications"));
        setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const targetOrg = isSuperAdmin ? filterOrgId : orgId;
        if (!targetOrg) return;
        const q = query(collection(db, "notifications"), where("orgId", "==", targetOrg));
        const snapshot = await getDocs(q);
        setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch {
      toast.error("Failed to load notifications");
    }
  }

  async function loadHolidays() {
    try {
      if (isSuperAdmin && filterOrgId === "ALL") {
        const snapshot = await getDocs(collection(db, "publicHolidays"));
        setHolidays(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date)));
      } else {
        const targetOrg = isSuperAdmin ? filterOrgId : orgId;
        if (!targetOrg) return;
        const q = query(collection(db, "publicHolidays"), where("orgId", "==", targetOrg));
        const snapshot = await getDocs(q);
        setHolidays(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch {
      toast.error("Failed to load holidays");
    }
  }

  // ----- Helpers -----
  function getRemainingLeaves(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return 0;

    // Convert holidays array to map for O(1) lookup
    const holidayMap = {};
    holidays.forEach(h => holidayMap[h.date] = h.name);

    const usedLeaves = leaveRequests
      .filter(l => {
        const categoryInfo = LEAVE_CATEGORIES[l.category];
        return l.userId === userId && l.status === "Approved" && categoryInfo?.type === "Deductable";
      })
      .reduce((sum, l) => {
        const isSingle = l.isSingleDay || l.from === l.to;
        return sum + calculateLeaveDuration(l.from, l.to, isSingle, l.halfType || l.timePeriod, l.startHalfType || "Full Day", l.endHalfType || "Full Day", user, holidayMap);
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
    if (!newUserEmail || !newUserName) {
      return toast.error("Please fill all fields");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      return toast.error("Please enter a valid email address");
    }

    // Validate name
    if (newUserName.trim().length < 2) {
      return toast.error("Name must be at least 2 characters long");
    }

    try {
      // Determine Org ID for creation
      let targetOrgId = orgId;
      let targetOrgName = org?.name;

      if (isSuperAdmin && filterOrgId !== "ALL") {
        targetOrgId = filterOrgId;
        const selectedOrgObj = orgs.find(o => o.id === filterOrgId);
        targetOrgName = selectedOrgObj?.name || "Organization";
      }

      // Check if user with this email already exists
      const existingUser = users.find(u => u.email.toLowerCase() === newUserEmail.toLowerCase());
      if (existingUser) {
        return toast.error("This email is already registered");
      }

      // Create user document in Firestore
      // User will authenticate via Google Sign-In, so no Firebase Auth user is created here
      const docRef = await addDoc(collection(db, "users"), {
        uid: "", // Will be populated when user signs in with Google
        name: newUserName.trim().charAt(0).toUpperCase() + newUserName.trim().slice(1).toLowerCase(),
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        orgId: targetOrgId, // <--- Link to Target Org
        leaveDaysAssigned: 0,
        workingDays: [],
        organizationName: targetOrgName || "",
        photoURL: "",
        createdAt: ts(),
      });

      // Update local state
      setUsers(prev => [...prev, {
        id: docRef.id,
        uid: "",
        name: newUserName.trim().charAt(0).toUpperCase() + newUserName.trim().slice(1).toLowerCase(),
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        orgId: targetOrgId,
        leaveDaysAssigned: 0,
        workingDays: [],
        organizationName: targetOrgName || "",
        photoURL: ""
      }]);

      // Send Welcome Email
      sendWelcomeEmail(newUserEmail, newUserName).then(result => {
        if (result && result.success) {
          toast.success("Welcome email sent");
        } else {
          console.error("Welcome email failed:", result?.error);
          toast.error("Welcome email failed");
        }
      });

      // Clear form
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("user");

      toast.success(`User ${newUserEmail} created successfully! They can now sign in with Google.`);

    } catch (error) {
      console.error("User creation error:", error);
      toast.error(`Failed to create user: ${error.message || "Unknown error"}`);
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

  // ----- Invitation System -----
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLinkSuccess, setInviteLinkSuccess] = useState("");

  async function handleInviteUser() {
    if (!inviteEmail) return toast.error("Please enter an email");

    // Check if user already exists in this org (optional, but good UX)
    if (users.some(u => u.email.toLowerCase() === inviteEmail.toLowerCase())) {
      return toast.error("User with this email already exists in this organization.");
    }

    setIsInviting(true);
    try {
      const token = crypto.randomUUID(); // Generate unique token
      const inviteLink = `${window.location.origin}/join?token=${token}`;

      // Determine Org ID for invite
      let targetOrgId = orgId;
      let targetOrgName = org?.name;

      if (isSuperAdmin && filterOrgId !== "ALL") {
        targetOrgId = filterOrgId;
        const selectedOrgObj = orgs.find(o => o.id === filterOrgId);
        targetOrgName = selectedOrgObj?.name || "Organization";
      }

      // 1. Create Invitation Doc
      await addDoc(collection(db, "invitations"), {
        email: inviteEmail.toLowerCase(),
        orgId: targetOrgId,
        orgName: targetOrgName,
        token: token,
        status: 'pending',
        createdAt: ts(),
        role: 'user' // Default to user for now
      });

      // 2. Send Email
      const result = await sendInvitationEmail(inviteEmail, inviteLink, targetOrgName || "our company");

      if (result.success) {
        toast.success(`Invitation created for ${inviteEmail}`);
        setInviteLinkSuccess(inviteLink); // Show success UI
      } else {
        toast.error("Failed to send email, but invite link created.");
        setInviteLinkSuccess(inviteLink); // Still show link
        console.error(result.error);
      }

    } catch (error) {
      console.error("Invite error:", error);
      toast.error("Failed to create invitation");
    } finally {
      setIsInviting(false);
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied!");
  };

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
      // Keep existing displayed days
      toast.success("Working days saved");
    } catch {
      toast.error("Failed to save working days");
    }
  }

  // ----- Book Leave -----
  async function bookLeave() {
    if (!selectedUser || !from || !to) return toast.error("Select all fields");

    const selectedUserObj = users.find(u => u.id === selectedUser);
    if (!selectedUserObj) return toast.error("Selected user not found");

    const userEmail = selectedUserObj.email || selectedUserObj.userEmail || selectedUserObj.googleId;
    console.log(userEmail);
    const userName = selectedUserObj.name || "User";

    try {
      const isSingleDay = from === to;

      // Determine Org ID
      let targetOrgId = orgId;
      if (isSuperAdmin && filterOrgId !== "ALL") {
        targetOrgId = filterOrgId;
      }
      // Or safer: rely on user's orgId since we found selectedUser
      if (selectedUserObj.orgId) {
        targetOrgId = selectedUserObj.orgId;
      }

      const leave = {
        userId: selectedUser,
        userName,
        orgId: targetOrgId, // <--- Link to Org
        from,
        to,
        type: leaveType,
        category: leaveCategory,
        reason,
        status: "Pending",
        isSingleDay,
        halfType: isSingleDay ? timePeriod : null,
        startHalfType: !isSingleDay ? startHalfType : null,
        endHalfType: !isSingleDay ? endHalfType : null,
        createdAt: ts()
      };

      // Save leave to Firestore
      const docRef = await addDoc(collection(db, "leaveRequests"), leave);

      // Update local state
      setLeaveRequests(prev => [...prev, { ...leave, id: docRef.id }]);

      // Add notification
      await addDoc(collection(db, "notifications"), {
        type: "leave_request",
        message: `Leave requested for ${userName}`,
        read: false,
        createdAt: ts(),
        orgId: targetOrgId, // <--- Link to Org
        meta: { userId: selectedUser }
      });

      // Send email only if user has a valid email
      if (userEmail) {
        const emailResult = await sendLeaveStatusEmail(userEmail, userName, "Pending", leave);
        if (!emailResult.success) {
          console.warn("Email failed to send", emailResult.error);
        }
      } else {
        console.warn("No email for selected user, skipping email notification");
      }

      // Reset form
      setFrom("");
      setTo("");
      setReason("");
      setLeaveType("Deductable");
      setLeaveCategory("Holiday");
      setTimePeriod("Full Day");

      toast.success("Leave booked successfully");

    } catch (err) {
      console.error("Failed to book leave:", err);
      toast.error("Failed to book leave");
    }
    const getCategoryColor = (category) => {
      return LEAVE_CATEGORIES[category]?.color || 'bg-slate-500';
    };

  }



  async function setLeaveStatus(id, status, reason = "") {
    try {
      await updateDoc(doc(db, "leaveRequests", id), {
        status,
        reviewedAt: ts(),
        adminResponse: reason // Save admin response/reason
      });
      setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status, adminResponse: reason } : l));
      toast.success(`Leave ${status.toLowerCase()}`);

      // Send Email Notification
      const request = leaveRequests.find(r => r.id === id);
      const user = users.find(u => u.id === request?.userId);

      if (request && user) {
        // Send Push Notification
        await sendPushNotification(
          user.id,
          `Leave ${status}`,
          `Your leave request from ${request.from} to ${request.to} has been ${status}. ${reason ? `Reason: ${reason}` : ''}`
        );

        console.log("Attempting to send email to:", user.email);
        // Pass reason to email service
        sendLeaveStatusEmail(user.email, user.name, status, request, reason).then(result => {
          if (result && result.success) {
            toast.success("Email notification sent");
          } else {
            const errorDetails = result?.error || "Unknown error";
            console.error("Email failed:", errorDetails);
            const msg = errorDetails.text || "Check console";
            toast.error(`Email failed: ${msg}`);
          }
        });
      }
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

  // ----- Holidays -----
  async function addHoliday() {
    if (!newHolidayName || !newHolidayDate) return toast.error("Enter name & date");
    try {
      let targetOrgId = orgId;
      if (isSuperAdmin && filterOrgId !== "ALL") {
        targetOrgId = filterOrgId;
      }

      const docRef = await addDoc(collection(db, "publicHolidays"), {
        name: newHolidayName,
        date: newHolidayDate,
        orgId: targetOrgId, // <--- Link to Org
        createdAt: ts()
      });
      setHolidays(prev => [...prev, { id: docRef.id, name: newHolidayName, date: newHolidayDate }].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHolidayName("");
      setNewHolidayDate("");
      toast.success("Holiday added");
    } catch {
      toast.error("Failed to add holiday");
    }
  }

  async function deleteHoliday(id) {
    if (!window.confirm("Make this a normal working day?")) return;
    try {
      await deleteDoc(doc(db, "publicHolidays", id));
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success("Holiday removed");
    } catch {
      toast.error("Failed to remove holiday");
    }
  }

  async function seedInternationalHolidays() {
    const currentYear = new Date().getFullYear();
    const internationalHolidays = [
      { name: "New Year's Day", date: `${currentYear}-01-01` },
      { name: "Valentine's Day", date: `${currentYear}-02-14` },
      { name: "International Women's Day", date: `${currentYear}-03-08` },
      { name: "Good Friday", date: `${currentYear}-04-18` }, // Approximate, varies yearly
      { name: "Easter Monday", date: `${currentYear}-04-21` }, // Approximate, varies yearly
      { name: "Labour Day", date: `${currentYear}-05-01` },
      { name: "Christmas Day", date: `${currentYear}-12-25` },
      { name: "Boxing Day", date: `${currentYear}-12-26` },
      { name: "New Year's Eve", date: `${currentYear}-12-31` }
    ];

    try {
      // Determine Org ID for seeding
      let targetOrgId = orgId;
      if (isSuperAdmin && filterOrgId !== "ALL") {
        targetOrgId = filterOrgId;
      }

      let addedCount = 0;
      for (const holiday of internationalHolidays) {
        // Check if holiday already exists
        const exists = holidays.some(h => h.date === holiday.date);
        if (!exists) {
          const docRef = await addDoc(collection(db, "publicHolidays"), {
            name: holiday.name,
            date: holiday.date,
            orgId: targetOrgId, // <--- Link to Org
            createdAt: ts()
          });
          setHolidays(prev => [...prev, { id: docRef.id, ...holiday }].sort((a, b) => a.date.localeCompare(b.date)));
          addedCount++;
        }
      }
      if (addedCount > 0) {
        toast.success(`Added ${addedCount} international holidays for ${currentYear}`);
      } else {
        toast.info("All international holidays already exist");
      }
    } catch (err) {
      console.error("Failed to seed holidays:", err);
      toast.error("Failed to add international holidays");
    }
  }

  // Year-End Reset Function
  async function handleYearEndReset() {
    if (!newYearAllocation || isNaN(newYearAllocation) || Number(newYearAllocation) < 0) {
      return toast.error("Please enter a valid allocation for the new year");
    }

    const allocation = Number(newYearAllocation);

    try {
      const updates = users.map(async (user) => {
        let finalAllocation = allocation;

        if (transferRemainingDays) {
          // Calculate remaining days
          const remaining = getRemainingLeaves(user.id);
          finalAllocation = allocation + (remaining > 0 ? remaining : 0);
        }

        // Update user's leave allocation
        await updateDoc(doc(db, "users", user.id), {
          leaveDaysAssigned: finalAllocation,
          lastResetYear: new Date().getFullYear()
        });

        return { ...user, leaveDaysAssigned: finalAllocation };
      });

      await Promise.all(updates);

      // Reload users to reflect changes
      await loadUsers();

      toast.success(
        transferRemainingDays
          ? `Year-end reset complete! ${allocation} days allocated + remaining days transferred.`
          : `Year-end reset complete! All users allocated ${allocation} days.`
      );

      // Reset form
      setNewYearAllocation("");
      setTransferRemainingDays(false);

    } catch (error) {
      console.error("Year-end reset failed:", error);
      toast.error("Failed to reset leave days");
    }
  }

  // Individual User Reset Function
  async function handleIndividualReset() {
    if (!resetTargetUser) return toast.error("Please select a user");
    if (!individualAllocation || isNaN(individualAllocation) || Number(individualAllocation) < 0) {
      return toast.error("Please enter a valid allocation");
    }

    const allocation = Number(individualAllocation);
    const user = users.find(u => u.id === resetTargetUser);
    if (!user) return toast.error("User not found");

    try {
      let finalAllocation = allocation;

      if (individualTransfer) {
        const remaining = getRemainingLeaves(resetTargetUser);
        finalAllocation = allocation + (remaining > 0 ? remaining : 0);
      }

      await updateDoc(doc(db, "users", resetTargetUser), {
        leaveDaysAssigned: finalAllocation,
        lastResetYear: new Date().getFullYear()
      });

      await loadUsers();

      toast.success(
        individualTransfer
          ? `${user.name} reset! ${allocation} days + ${getRemainingLeaves(resetTargetUser)} remaining = ${finalAllocation} days.`
          : `${user.name} reset to ${allocation} days.`
      );

      setResetTargetUser("");
      setIndividualAllocation("");
      setIndividualTransfer(false);

    } catch (error) {
      console.error("Individual reset failed:", error);
      toast.error("Failed to reset user");
    }
  }


  const remainingLeaves = selectedUser ? getRemainingLeaves(selectedUser) : "-";

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => {
        setTab(id);
        setMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${tab === id
        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
        }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium text-sm whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark-bg text-slate-900 dark:text-dark-text overflow-hidden font-sans transition-colors duration-200">

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-white/10 animate-fade-in-up">
            <h3 className="text-xl font-heading font-bold mb-2">Confirm Action</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Do you want to <strong className={actionModal.action === "Approved" ? "text-emerald-500" : "text-red-500"}>{actionModal.action}</strong> the leave request for <strong>{actionModal.userName}</strong>?
            </p>

            {actionModal.action === "Rejected" && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-900 dark:text-white resize-none"
                  rows="3"
                  placeholder="e.g., Low leave balance, Critical project timeline..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                ></textarea>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setActionModal(null); setSearchParams({}); }}
                className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-transform hover:scale-105 ${actionModal.action === "Approved"
                  ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                  : "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                  }`}
              >
                Confirm {actionModal.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-white/10 animate-fade-in-up">
            <h3 className="text-xl font-heading font-bold mb-2">
              {inviteLinkSuccess ? "Invitation Sent!" : "Invite Team Member"}
            </h3>

            {!inviteLinkSuccess ? (
              <>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                  Send an email invitation. Attempts to join will be linked to <strong>{org?.name}</strong>.
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowInviteModal(false); setInviteEmail(""); }}
                    className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    disabled={isInviting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInviteUser}
                    disabled={isInviting}
                    className="px-4 py-2 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInviting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Sending...
                      </>
                    ) : (
                      "Send Invite"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-emerald-600 dark:text-emerald-400 mb-4 text-sm font-medium">
                  User has been emailed! You can also share this link directly:
                </p>

                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mb-4 break-all text-xs font-mono border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                  {inviteLinkSuccess}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => copyToClipboard(inviteLinkSuccess)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white py-2.5 rounded-lg font-medium transition-colors"
                  >
                    <span className="h-5 w-5">📋</span> Copy Link
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Join ${org?.name || 'our team'} on TimeAway here: ${inviteLinkSuccess}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg"
                  >
                    <span className="h-5 w-5">💬</span> Share on WhatsApp
                  </a>

                  <button
                    onClick={() => { setShowInviteModal(false); setInviteEmail(""); setInviteLinkSuccess(""); }}
                    className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm mt-2"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e293b',
          color: '#fff',
        }
      }} />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg text-slate-500 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-white dark:bg-dark-card border-r border-slate-200 dark:border-white/5 p-6 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <div className="mb-8 px-2">
          <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          {isSuperAdmin && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Super Admin View
              </label>
              <select
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={filterOrgId}
                onChange={(e) => setFilterOrgId(e.target.value)}
              >
                <option value="ALL">All Organizations</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem id="usersOrgs" icon={UsersIcon} label="Users & Organizations" />
          <SidebarItem id="leaveMgmt" icon={CalendarDaysIcon} label="Leave Management" />
          <SidebarItem id="holidays" icon={GlobeAmericasIcon} label="Public Holidays" />
          <SidebarItem id="yearEndReset" icon={CalendarDaysIcon} label="Year-End Reset" />
          <SidebarItem id="notificationsTab" icon={BellIcon} label="Notifications" />
          {isSuperAdmin && (
            <SidebarItem id="logs" icon={ClipboardDocumentListIcon} label="System Logs" />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 space-y-2">
          <div className="flex flex-col gap-2 px-4">
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <button
                onClick={() => navigate("/user-dashboard")}
                className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                User View
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-dark-card hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto animate-fade-in">

          {/* Users & Orgs Tab */}
          {tab === "usersOrgs" && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Create User Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                    <PlusIcon className="h-5 w-5 text-primary-400" />
                    Create New User
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        className="bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        placeholder="Full Name"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                      />
                      <input
                        className="bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        placeholder="Email Address"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <select
                        className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Users will sign in using their Google account
                    </p>
                    <button
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20"
                      onClick={createUser}
                    >
                      Create User
                    </button>
                  </div>
                </div>

                {/* Create Org Card (Super Admin Only) */}
                {isSuperAdmin && (
                  <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                    <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                      <BuildingOfficeIcon className="h-5 w-5 text-secondary-400" />
                      Organization Management
                    </h2>
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all text-slate-900 dark:text-white"
                          placeholder="Organization Name"
                          value={newOrg}
                          onChange={e => setNewOrg(e.target.value)}
                        />
                        <button
                          className="bg-secondary-600 hover:bg-secondary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-secondary-600/20 w-full sm:w-auto"
                          onClick={createOrg}
                        >
                          Add
                        </button>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Move User to Organization
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <select
                            className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all text-slate-900 dark:text-white"
                            value={selectedUser}
                            onChange={e => setSelectedUser(e.target.value)}
                          >
                            <option value="">Select User</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.organizationName || "No Org"})</option>
                            ))}
                          </select>
                          <select
                            className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all text-slate-900 dark:text-white"
                            value={selectedOrg}
                            onChange={e => setSelectedOrg(e.target.value)}
                          >
                            <option value="">Select Organization</option>
                            {orgs.map(o => (
                              <option key={o.id} value={o.name}>{o.name}</option>
                            ))}
                          </select>
                          <button
                            className="bg-secondary-600 hover:bg-secondary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-secondary-600/20 w-full sm:w-auto"
                            onClick={assignUserToOrg}
                          >
                            Move
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Users Table */}
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold">User Directory</h2>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                  >
                    <UsersIcon className="h-4 w-4" />
                    Invite User
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">Name</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">Email</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">Role</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap hidden md:table-cell">Organization</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-center whitespace-nowrap">Leave</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">{u.name || "-"}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-500 dark:text-slate-400 max-w-[150px] truncate">{u.email}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-500 dark:text-slate-400 hidden md:table-cell">{u.organizationName || "-"}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-center whitespace-nowrap">
                            <span className="text-emerald-400 font-bold">{getRemainingLeaves(u.id)}</span>
                            <span className="text-slate-500 text-xs ml-1">/ {u.leaveDaysAssigned || 0}</span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                            <button
                              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-1.5 sm:p-2 rounded-lg transition-all"
                              onClick={() => deleteUser(u.id)}
                              title="Delete User"
                            >
                              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Configuration Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl space-y-6 sm:space-y-8 transition-colors duration-200">
                  <div>
                    <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6">Leave Allocation</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <div className="flex gap-3 flex-wrap">
                        <input
                          className="flex-1 sm:w-24 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                          placeholder="Days"
                          value={leaveDays}
                          onChange={e => setLeaveDays(e.target.value)}
                        />
                        <button
                          className="flex flex-wrap bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                          onClick={saveLeaveDays}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    {selectedUser && (
                      <div className="mt-4 p-4 bg-slate-100 dark:bg-white/5 rounded-lg flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Current Balance</span>
                        <span className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{remainingLeaves} Days</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 dark:border-white/5 pt-6 sm:pt-8">
                    <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6">Working Days</h2>
                    <div className="flex flex-wrap gap-3 mb-6">
                      {WEEK.map(day => (
                        <label key={day} className={`
                          cursor-pointer px-3 py-2 rounded-lg border transition-all select-none
                          ${workingDays.includes(day)
                            ? 'bg-primary-500/20 border-primary-500 text-primary-500 dark:text-primary-300'
                            : 'bg-slate-50 dark:bg-dark-bg border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/30'}
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
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6">Book Leave</h2>
                  <div className="space-y-4">
                    <select
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                      value={selectedUser}
                      onChange={e => setSelectedUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 ml-1">From</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                          value={from}
                          onChange={e => setFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 ml-1">To</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                          value={to}
                          onChange={e => setTo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <select
                        className="bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        value={leaveType}
                        onChange={e => setLeaveType(e.target.value)}
                      >
                        <option value="Deductable">Deductable</option>
                        <option value="Non-Deductable">Non-Deductable</option>
                      </select>
                      <select
                        className="bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        value={leaveCategory}
                        onChange={e => setLeaveCategory(e.target.value)}
                      >
                        {Object.keys(LEAVE_CATEGORIES)
                          .filter(cat => LEAVE_CATEGORIES[cat].type === leaveType)
                          .map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                      </select>
                    </div>

                    {from && to && from !== to ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500 dark:text-slate-400 ml-1">Start Day Type</label>
                          <select
                            className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-white"
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
                            className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm text-slate-900 dark:text-white"
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
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 ml-1">Time Period</label>
                        <select
                          className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                          value={timePeriod}
                          onChange={e => setTimePeriod(e.target.value)}
                        >
                          <option value="Full Day">Full Day</option>
                          <option value="Morning">Start of Day (Morning)</option>
                          <option value="Afternoon">Afternoon</option>
                        </select>
                      </div>
                    )}

                    <textarea
                      className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all h-24 resize-none text-slate-900 dark:text-white"
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
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold">Leave Requests</h2>
                  <button
                    className="text-red-400 hover:text-red-300 text-sm font-medium hover:underline"
                    onClick={clearLeaveRequests}
                  >
                    Clear History
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">User</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">Dates</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap hidden md:table-cell">Details</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">Status</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {leaveRequests.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap">{l.userName}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col text-xs sm:text-sm">
                              <span>{l.from}</span>
                              <span className="text-slate-400 dark:text-slate-600">to</span>
                              <span>{l.to}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium">{l.category}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-500">{LEAVE_CATEGORIES[l.category]?.type || l.type}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-medium ${l.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' :
                              l.status === 'Rejected' ? 'bg-red-500/20 text-red-300' :
                                'bg-amber-500/20 text-amber-300'
                              }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                            {l.status === "Pending" && (
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <button
                                  className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  onClick={() => setLeaveStatus(l.id, "Approved")}
                                  title="Approve"
                                >
                                  <CheckCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                </button>
                                <button
                                  className="p-1 sm:p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  onClick={() => setLeaveStatus(l.id, "Rejected")}
                                  title="Reject"
                                >
                                  <XCircleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
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

          {/* Holidays Tab */}
          {tab === "holidays" && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              {/* Add Holiday Card */}
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                  <PlusIcon className="h-5 w-5 text-primary-400" />
                  Add Public Holiday
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    className="flex-1 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                    placeholder="Holiday Name (e.g. New Year's Day)"
                    value={newHolidayName}
                    onChange={e => setNewHolidayName(e.target.value)}
                  />
                  <input
                    type="date"
                    className="bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                    value={newHolidayDate}
                    onChange={e => setNewHolidayDate(e.target.value)}
                  />
                  <button
                    className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20"
                    onClick={addHoliday}
                  >
                    Add Holiday
                  </button>
                </div>

                {/* Quick Add International Holidays */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                  <button
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    onClick={seedInternationalHolidays}
                  >
                    <GlobeAmericasIcon className="h-5 w-5" />
                    Auto-Add International Holidays ({new Date().getFullYear()})
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center italic">
                    Adds: New Year's, Christmas, Easter, Labour Day, etc.
                  </p>
                </div>
              </div>

              {/* Holidays List */}
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold">Public Holidays List</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Holiday Name</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {holidays.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-6 py-8 text-center text-slate-500">
                            No public holidays defined
                          </td>
                        </tr>
                      ) : (
                        holidays.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium">{h.date}</td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-300">{h.name}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-all"
                                onClick={() => deleteHoliday(h.id)}
                                title="Make normal working day"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}


          {/* Year-End Reset Tab */}
          {tab === "yearEndReset" && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Bulk Reset Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-primary-400" />
                    Reset All Users
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        New Year Allocation (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-slate-900 dark:text-white"
                        placeholder="e.g., 20"
                        value={newYearAllocation}
                        onChange={(e) => setNewYearAllocation(e.target.value)}
                      />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-500/20 rounded-lg">
                      <input
                        type="checkbox"
                        id="bulkTransferDays"
                        checked={transferRemainingDays}
                        onChange={(e) => setTransferRemainingDays(e.target.checked)}
                        className="mt-1 w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="bulkTransferDays" className="flex-1 cursor-pointer">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          Transfer Remaining Days
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Add unused leave days to new allocation
                        </span>
                      </label>
                    </div>

                    <button
                      onClick={handleYearEndReset}
                      className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-primary-600/20"
                    >
                      Reset All Users
                    </button>
                  </div>
                </div>

                {/* Individual Reset Card */}
                <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-4 sm:p-6 rounded-2xl shadow-xl transition-colors duration-200">
                  <h2 className="text-lg sm:text-xl font-heading font-semibold mb-4 sm:mb-6 flex items-center gap-2">
                    <UsersIcon className="h-5 w-5 text-secondary-400" />
                    Reset Individual User
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Select User
                      </label>
                      <select
                        className="w-full bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all text-slate-900 dark:text-white"
                        value={resetTargetUser}
                        onChange={(e) => setResetTargetUser(e.target.value)}
                      >
                        <option value="">Select User</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        New Allocation (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-300 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-all text-slate-900 dark:text-white"
                        placeholder="e.g., 20"
                        value={individualAllocation}
                        onChange={(e) => setIndividualAllocation(e.target.value)}
                      />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-secondary-50 dark:bg-secondary-900/10 border border-secondary-200 dark:border-secondary-500/20 rounded-lg">
                      <input
                        type="checkbox"
                        id="individualTransferDays"
                        checked={individualTransfer}
                        onChange={(e) => setIndividualTransfer(e.target.checked)}
                        className="mt-1 w-4 h-4 text-secondary-600 border-slate-300 rounded focus:ring-secondary-500"
                      />
                      <label htmlFor="individualTransferDays" className="flex-1 cursor-pointer">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          Transfer Remaining Days
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Add unused days to new allocation
                        </span>
                      </label>
                    </div>

                    <button
                      onClick={handleIndividualReset}
                      className="w-full bg-secondary-600 hover:bg-secondary-500 text-white py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-secondary-600/20"
                    >
                      Reset User
                    </button>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                  ⚠️ Important Information
                </h3>
                <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
                  <li>Bulk reset updates <strong>all users</strong> at once</li>
                  <li>Individual reset allows you to reset specific users one at a time</li>
                  <li>Transfer option adds remaining days to the new allocation</li>
                  <li>Without transfer, unused days will be lost</li>
                  <li>Reset year is tracked in user profiles</li>
                </ul>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {tab === "notificationsTab" && (
            <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto transition-colors duration-200">
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5">
                <h2 className="text-lg sm:text-xl font-heading font-semibold">Notifications</h2>
              </div>
              <ul className="divide-y divide-slate-200 dark:divide-white/5">
                {notifications.length === 0 && (
                  <li className="p-6 sm:p-8 text-center text-slate-500">No notifications yet</li>
                )}
                {notifications.map(n => (
                  <li key={n.id} className={`p-4 sm:p-6 transition-colors ${n.read ? 'bg-transparent' : 'bg-primary-50 dark:bg-primary-500/5'}`}>
                    <div className="flex justify-between items-start gap-3 sm:gap-4">
                      <div className="flex gap-3 sm:gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${n.read ? 'bg-slate-400 dark:bg-slate-600' : 'bg-primary-500'}`} />
                        <p className={`text-sm sm:text-base ${n.read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white font-medium'}`}>
                          {n.message}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          className="text-xs font-medium text-primary-400 hover:text-primary-300 whitespace-nowrap flex-shrink-0"
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
          {/* System Logs Tab (Super Admin Only) */}
          {tab === "logs" && isSuperAdmin && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-xl transition-colors duration-200">
                <h2 className="text-xl font-heading font-semibold mb-6 flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-primary-400" />
                  System Activity Logs
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/5 text-xs uppercase tracking-wide text-slate-500 font-semibold">
                        <th className="p-4">Time</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Message</th>
                        <th className="p-4">Org ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {notifications.length > 0 ? (
                        notifications.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="p-4 text-slate-500 font-mono text-xs">
                              {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : "Just now"}
                            </td>
                            <td className="p-4 text-xs font-medium uppercase text-primary-500">
                              {log.type}
                            </td>
                            <td className="p-4 text-slate-700 dark:text-slate-300">
                              {log.message}
                            </td>
                            <td className="p-4 text-xs font-mono text-slate-400">
                              {log.orgId || "N/A"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-slate-400 italic">No logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
