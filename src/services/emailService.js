import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '../config/emailConfig';

export const sendLeaveStatusEmail = async (userEmail, userName, status, leaveDetails) => {
    if (!userEmail) {
        console.warn("No recipient email provided");
        return { success: false, error: "No recipient email" };
    }

    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") {
        console.warn("EmailJS credentials not configured. Email will not be sent.");
        return { success: false, error: "EmailJS not configured" };
    }

    // Safe template parameters with fallback/default values
    const templateParams = {
        email: userEmail,
        to_name: userName || "User",
        status: status || "Pending",
        start_date: leaveDetails?.from || "",
        end_date: leaveDetails?.to || "",
        leave_type: leaveDetails?.type || "",
        leave_category: leaveDetails?.category || "",
        message: `Your leave request for ${leaveDetails?.category || "N/A"} (${leaveDetails?.from || "N/A"} to ${leaveDetails?.to || "N/A"}) has been ${status || "Pending"}.`
    };

    try {
        console.log("Sending email with params:", templateParams);
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        console.log('Email sent successfully!', response.status, response.text);
        return { success: true };
    } catch (err) {
        console.error('Failed to send email:', err);
        return { success: false, error: err };
    }
};

// Optional: welcome email function (also safe)
export const sendWelcomeEmail = async (userEmail, userName) => {
    if (!userEmail) {
        console.warn("No recipient email provided for welcome email");
        return { success: false, error: "No recipient email" };
    }

    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") {
        console.warn("EmailJS credentials not configured. Email will not be sent.");
        return { success: false, error: "EmailJS not configured" };
    }

    const templateParams = {
        to_email: userEmail,
        to_name: userName || "User",
        subject: "Welcome to Leave Management System",
        message: "You have been registered in the Leave Management System. You can now log in using your Google account."
    };

    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        console.log("Welcome email sent!", response.status, response.text);
        return { success: true };
    } catch (err) {
        console.error("Failed to send welcome email", err);
        return { success: false, error: err };
    }
};
// Notify Admin of a new leave request
export const sendNewLeaveRequestEmail = async (leaveDetails, userName) => {
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") {
        console.warn("EmailJS credentials not configured.");
        return { success: false, error: "EmailJS not configured" };
    }

    // Generate Deep Links for Email Actions
    const origin = window.location.origin;
    const approveUrl = `${origin}/admin?action=Approved&id=${leaveDetails.id}`;
    const rejectUrl = `${origin}/admin?action=Rejected&id=${leaveDetails.id}`;

    // You might want to configure a specific ADMIN_EMAIL or just rely on the template routing
    // For now, we'll assume the template sends to a configured Admin address or back to the system
    const templateParams1 = {
        email: "akmusajee53@gmail.com",
        user_name: userName || "User",
        leave_type: leaveDetails?.type || "",
        leave_category: leaveDetails?.category || "",
        start_date: leaveDetails?.from || "",
        end_date: leaveDetails?.to || "",
        reason: leaveDetails?.reason || "No reason provided",
        message: `New leave request from ${userName} (${leaveDetails?.from} to ${leaveDetails?.to}). Reason: ${leaveDetails?.reason}`,
        approve_url: approveUrl,
        reject_url: rejectUrl
    };

    try {
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID1, // You might want a separate template ID for Admin User Requests if needed, or reuse
            templateParams1,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        console.log("Admin notification sent!", response.status, response.text);
        return { success: true };
    } catch (err) {
        console.error("Failed to send admin notification", err);
        return { success: false, error: err };
    }
};
