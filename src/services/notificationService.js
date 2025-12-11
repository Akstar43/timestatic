// src/services/notificationService.js
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { db, ts } from "../firebase/firebase";

/**
 * Sends a push notification to a user.
 * 
 * NOTE: In a real production app, you CANNOT send Firebase Cloud Messaging (FCM) 
 * messages directly from the client (browser) securely because it requires the 
 * Server Key. 
 * 
 * For this implementation, we will:
 * 1. Log the notification to the Firestore 'notifications' collection (which we already do).
 * 2. Log to console as a "Mock" push.
 * 3. Provide the structure where you WOULD call your backend API.
 * 
 * @param {string} userId - The Firestore ID of the user to notify.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 */
export const sendPushNotification = async (userId, title, body) => {
    try {
        // 1. Get User's FCM Token
        const userSnapshot = await getDocs(query(collection(db, "users"), where("__name__", "==", userId)));
        // Note: "__name__" queries by document ID. Or if userId is actually the UID field? 
        // In AdminPage, we usually have the Firestore Document ID. Let's check if we fail, try uid.

        let userDoc = null;
        let fcmToken = null;

        if (!userSnapshot.empty) {
            userDoc = userSnapshot.docs[0].data();
            fcmToken = userDoc.fcmToken;
        } else {
            // Try querying by 'uid' field just in case
            const q2 = query(collection(db, "users"), where("uid", "==", userId));
            const s2 = await getDocs(q2);
            if (!s2.empty) {
                userDoc = s2.docs[0].data();
                fcmToken = userDoc.fcmToken;
            }
        }

        if (!fcmToken) {
            console.warn(`[Notification] User ${userId} has no FCM token. Skipping push.`);
            return;
        }

        console.log(`[Notification] 🚀 SENDING PUSH to ${userDoc.name || userId}`);

        // --- REAL SEND BLOCK (Secure Backend) ---
        // We call our own Vercel Serverless Function which holds the secrets securely.

        const response = await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: fcmToken,
                title: title,
                body: body
            })
        });

        if (response.ok) {
            console.log("[Notification] ✅ Push sent via Backend API");
        } else {
            const errData = await response.json();
            console.error("[Notification] ❌ Backend API failed:", errData.error);
        }
        // ------------------------------------------

        // Since we don't have a backend, we can only essentially "simulate" the push 
        // or rely on the Firestore 'notifications' collection which feeds the in-app dropdown.

        // We can also create a Firestore entry if one doesn't exist for this event yet,
        // but the calling functions usually do that. This service focuses on the PUSH aspect.

    } catch (error) {
        console.error("Failed to send push notification:", error);
    }
};

/**
 * Checks if leave balance is low and sends warning if so.
 * @param {number} remaining - Users remaining leave balance.
 * @param {string} userId - User ID.
 */
export const checkAndNotifyLowBalance = async (remaining, userId) => {
    // Threshold: Warn if 3 or fewer days remaining
    if (remaining <= 3 && remaining > 0) {
        // Check if we already warned recently? (For simplicity, we won't debounce deeply here)
        await sendPushNotification(
            userId,
            "Low Leave Balance",
            `You have only ${remaining} days of leave remaining.`
        );
    }
};
