import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG } from '../config/emailConfig';

export const sendLeaveStatusEmail = async (userEmail, userName, status, leaveDetails) => {
    if (!userEmail) {
        console.warn("No email provided for notification");
        return;
    }

    // Warning if credentials are not set
    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") {
        console.warn("EmailJS credentials not configured. Email will not be sent.");
        return false;
    }

    const templateParams = {
        to_email: userEmail,
        to_name: userName,
        status: status,
        start_date: leaveDetails.from,
        end_date: leaveDetails.to,
        leave_type: leaveDetails.type,
        leave_category: leaveDetails.category,
        message: `Your leave request for ${leaveDetails.category} (${leaveDetails.from} to ${leaveDetails.to}) has been ${status}.`
    };

    try {
        console.log("Sending email with params:", templateParams);
        console.log("Using Public Key:", EMAILJS_CONFIG.PUBLIC_KEY);
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

export const sendWelcomeEmail = async (userEmail, userName) => {
    if (!userEmail) return;

    if (EMAILJS_CONFIG.SERVICE_ID === "YOUR_SERVICE_ID") return false;

    const templateParams = {
        to_email: userEmail,
        to_name: userName,
        subject: "Welcome to Leave Management System",
        message: "You have been registered in the Leave Management System. You can now log in using your Google account."
    };

    try {
        await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams,
            EMAILJS_CONFIG.PUBLIC_KEY
        );
        return { success: true };
    } catch (err) {
        console.error("Failed to send welcome email", err);
        return { success: false, error: err };
    }
};
