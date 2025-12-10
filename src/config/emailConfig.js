// src/config/emailConfig.js
// TODO: Replace these with your actual EmailJS credentials
// You can sign up at https://www.emailjs.com/
// 1. Create a service (e.g., Gmail)
// 2. Create an email template
// 3. Get your Public Key

export const EMAILJS_CONFIG = {
    SERVICE_ID: "service_754x2vf",   // e.g. "service_xxxxx"

    // Template 1: General Notification (No Actions)
    // Used for: Welcome, Status Updates, OTP, Cancellations
    TEMPLATE_GENERAL: "template_vens1wj",

    // Template 2: Admin Action (With Approve/Reject Links)
    // Used for: New Leave Requests
    TEMPLATE_ADMIN_ACTION: "template_c56yo2d",

    PUBLIC_KEY: "XcrhBMAcXKgv4hRy_"    // e.g. "user_xxxxx" or public key from Account > API Keys
};
