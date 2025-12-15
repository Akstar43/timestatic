import {
    getLeaveStatusTemplate,
    getWelcomeTemplate,
    getNewLeaveRequestTemplate,
    getOtpTemplate,
    getCancellationTemplate,
    getInvitationTemplate
} from './emailTemplates';

// ⚠️ FEATURE FLAG: Set to false to disable all emails (for testing)
const EMAILS_ENABLED = true;

const sendEmailApi = async (data) => {
    if (!EMAILS_ENABLED) return { success: true, warning: "Emails disabled" };

    try {
        const response = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (response.ok && result.success) {
            return { success: true };
        } else {
            console.error("API Email Error:", result);
            return { success: false, error: result.error || "Unknown API error" };
        }
    } catch (error) {
        console.error("Network/Fetch Error:", error);
        return { success: false, error: error.message };
    }
};

export const sendLeaveStatusEmail = async (userEmail, userName, status, leaveDetails, reason = "") => {
    if (!userEmail) return { success: false, error: "No recipient email" };

    return sendEmailApi({
        to: userEmail,
        subject: `Leave Request ${status} - TimeAway`,
        html: getLeaveStatusTemplate(userName, status, leaveDetails, reason)
    });
};

export const sendWelcomeEmail = async (userEmail, userName) => {
    if (!userEmail) return { success: false, error: "No email" };

    return sendEmailApi({
        to: userEmail,
        subject: "Welcome to TimeAway!",
        html: getWelcomeTemplate(userName)
    });
};

export const sendNewLeaveRequestEmail = async (leaveDetails, userName) => {
    const origin = window.location.origin;
    // Note: Deep links might need simpler auth handling if admin isn't logged in
    const approveUrl = `${origin}/admin?action=Approved&id=${leaveDetails.id}`;
    const rejectUrl = `${origin}/admin?action=Rejected&id=${leaveDetails.id}`;

    // Hardcoded Admin Email for notification (or fetch from config)
    return sendEmailApi({
        to: "akmusajee53@gmail.com",
        subject: `New Leave Request: ${userName}`,
        html: getNewLeaveRequestTemplate(userName, leaveDetails, approveUrl, rejectUrl)
    });
};

export const sendOTPEmail = async (userEmail, otp, userName) => {
    return sendEmailApi({
        to: userEmail,
        subject: "Your Login Code",
        html: getOtpTemplate(userName, otp)
    });
};

export const sendLeaveCancellationEmail = async (leaveDetails, userName) => {
    return sendEmailApi({
        to: "akmusajee53@gmail.com",
        subject: `Leave Cancelled: ${userName}`,
        html: getCancellationTemplate(userName, leaveDetails)
    });
};

export const sendInvitationEmail = async (email, inviteLink, orgName) => {
    if (!email) return { success: false, error: "No recipient email" };

    return sendEmailApi({
        to: email,
        subject: `Invitation to join ${orgName}`,
        html: getInvitationTemplate(orgName, inviteLink)
    });
};
