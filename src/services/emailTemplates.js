export const getLeaveStatusTemplate = (userName, status, leaveDetails, reason) => {
    const statusColor = status === "Approved" ? "#10b981" : status === "Rejected" ? "#ef4444" : "#6b7280";
    let html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Leave Request Update</h2>
        <p>Hi ${userName},</p>
        <p>Your leave request for <strong>${leaveDetails?.category}</strong> (${leaveDetails?.from} to ${leaveDetails?.to}) has been <strong style="color: ${statusColor}">${status}</strong>.</p>
    `;

    if (status === "Rejected" && reason) {
        html += `<p><strong>Reason:</strong> ${reason}</p>`;
    }

    html += `<p>Regards,<br>TimeAway Team</p></div>`;
    return html;
};

export const getWelcomeTemplate = (userName) => {
    return `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to TimeAway!</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>You have been successfully registered on the TimeAway platform.</p>
        <p>You can now log in using your Google account or via Email OTP.</p>
        <p>Regards,<br>TimeAway Team</p>
    </div>`;
};

export const getNewLeaveRequestTemplate = (userName, leaveDetails, approveUrl, rejectUrl) => {
    return `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>New Leave Request</h2>
        <p><strong>${userName}</strong> has requested leave.</p>
        <ul>
            <li><strong>Type:</strong> ${leaveDetails?.type}</li>
            <li><strong>Category:</strong> ${leaveDetails?.category}</li>
            <li><strong>Dates:</strong> ${leaveDetails?.from} to ${leaveDetails?.to}</li>
            <li><strong>Reason:</strong> ${leaveDetails?.reason}</li>
        </ul>
        <div style="margin-top: 20px;">
            <a href="${approveUrl}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; font-weight: bold;">Approve</a>
            <a href="${rejectUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reject</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">This is an automated notification.</p>
    </div>`;
};

export const getOtpTemplate = (userName, otp) => {
    return `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Login Verification</h2>
        <p>Hi ${userName || "User"},</p>
        <p>Your login verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #4f46e5;">${otp}</div>
        <p>This code expires in 10 minutes.</p>
    </div>`;
};

export const getCancellationTemplate = (userName, leaveDetails) => {
    return `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Leave Cancelled</h2>
        <p><strong>${userName}</strong> has cancelled their leave.</p>
        <p><strong>Details:</strong> ${leaveDetails?.category} from ${leaveDetails?.from} to ${leaveDetails?.to}</p>
    </div>`;
};

export const getInvitationTemplate = (orgName, inviteLink) => {
    return `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>You're Invited!</h2>
        <p>You have been invited to join <strong>${orgName}</strong> on TimeAway.</p>
        <div style="margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join Now</a>
        </div>
        <p>If the button doesn't work, copy this link: <br>${inviteLink}</p>
    </div>`;
};
