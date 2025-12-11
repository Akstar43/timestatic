import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '../config/emailConfig';

// ⚠️ FEATURE FLAG: Set to false to disable all emails (for testing)
const EMAILS_ENABLED = false;


export const sendLeaveStatusEmail = async (userEmail, userName, status, leaveDetails, reason = "") => {
    if (!EMAILS_ENABLED) return { success: true, error: "Emails disabled" };
    if (!userEmail) return { success: false, error: "No recipient email" };
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return { success: false, error: "EmailJS not configured" };

    const statusColor = status === "Approved" ? "#10b981" : status === "Rejected" ? "#ef4444" : "#6b7280";

    // Construct message body
    let messageBody = `Your leave request for ${leaveDetails?.category} (${leaveDetails?.from} to ${leaveDetails?.to}) has been ${status}.`;
    if (status === "Rejected" && reason) {
        messageBody += ` Reason: ${reason}`;
    }

    const templateParams = {
        to_email: userEmail,
        to_name: userName || "User",
        subject: `Leave Request ${status}`,
        title: `Leave Request Update`,
        message: messageBody,
        // Optional: pass status color if template supports it, else ignored
        status_color: statusColor
    };

    try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_GENERAL, templateParams, EMAILJS_CONFIG.PUBLIC_KEY);
        console.log("Status email sent!");
        return { success: true };
    } catch (err) {
        console.error("Failed to send status email", err);
        return { success: false, error: err };
    }
};

export const sendWelcomeEmail = async (userEmail, userName) => {
    if (!EMAILS_ENABLED) return { success: true, error: "Emails disabled" };
    if (!userEmail) return { success: false, error: "No email" };
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return { success: false, error: "Not configured" };

    const templateParams = {
        to_email: userEmail,
        to_name: userName || "User",
        subject: "Welcome to TimeStatic",
        title: "Welcome aboard!",
        message: "You have been registered. You can now log in using your Google account or Email OTP."
    };

    try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_GENERAL, templateParams, EMAILJS_CONFIG.PUBLIC_KEY);
        console.log("Welcome email sent!");
        return { success: true };
    } catch (err) {
        console.error("Failed to send welcome email", err);
        return { success: false, error: err };
    }
};

export const sendNewLeaveRequestEmail = async (leaveDetails, userName) => {
    if (!EMAILS_ENABLED) return { success: true, error: "Emails disabled" };
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return { success: false, error: "Not configured" };

    const origin = window.location.origin;
    const approveUrl = `${origin}/admin?action=Approved&id=${leaveDetails.id}`;
    const rejectUrl = `${origin}/admin?action=Rejected&id=${leaveDetails.id}`;

    const messageBody = `New request from ${userName}. Type: ${leaveDetails?.type}, Category: ${leaveDetails?.category}, Dates: ${leaveDetails?.from} to ${leaveDetails?.to}. Reason: ${leaveDetails?.reason}`;

    const templateParams = {
        to_email: "akmusajee53@gmail.com",
        to_name: "Admin",
        subject: `New Leave Request: ${userName}`,
        title: "New Leave Request",
        message: messageBody,
        approve_url: approveUrl,
        reject_url: rejectUrl
    };

    try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ADMIN_ACTION, templateParams, EMAILJS_CONFIG.PUBLIC_KEY);
        console.log("Admin notification sent!");
        return { success: true };
    } catch (err) {
        console.error("Failed to send admin email", err);
        return { success: false, error: err };
    }
};

export const sendOTPEmail = async (userEmail, otp, userName) => {
    if (!EMAILS_ENABLED) return { success: true, error: "Emails disabled" };
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return { success: false, error: "Not configured" };

    const templateParams = {
        to_email: userEmail,
        to_name: userName || "User",
        subject: "Your Login Code",
        title: "Login Verification",
        message: `Your login code is: ${otp}. It expires in 10 minutes.`
    };

    try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_GENERAL, templateParams, EMAILJS_CONFIG.PUBLIC_KEY);
        console.log("OTP email sent!");
        return { success: true };
    } catch (err) {
        console.error("Failed to send OTP email", err);
        return { success: false, error: err };
    }
};

export const sendLeaveCancellationEmail = async (leaveDetails, userName) => {
    if (!EMAILS_ENABLED) return { success: true, error: "Emails disabled" };
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return { success: false, error: "Not configured" };

    const messageBody = `${userName} has cancelled their leave (${leaveDetails?.category}, ${leaveDetails?.from} to ${leaveDetails?.to}).`;

    const templateParams = {
        to_email: "akmusajee53@gmail.com",
        to_name: "Admin",
        subject: `Leave Cancelled: ${userName}`,
        title: "Leave Cancellation",
        message: messageBody
    };

    try {
        await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_GENERAL, templateParams, EMAILJS_CONFIG.PUBLIC_KEY);
        console.log("Cancellation email sent!");
        return { success: true };
    } catch (err) {
        console.error("Failed to send cancellation email", err);
        return { success: false, error: err };
    }
};
