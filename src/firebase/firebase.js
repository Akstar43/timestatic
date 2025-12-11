// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyDZazC0DmzvyH1tTD6F8XCtTNL4xnM4oBI",
  authDomain: "timestatic-77f36.firebaseapp.com",
  projectId: "timestatic-77f36",
  storageBucket: "timestatic-77f36.firebasestorage.app",
  messagingSenderId: "5099212438",
  appId: "1:5099212438:web:57281af287461b3319fcb7"
};

// Initialize Firebase (Primary app for normal operations)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enforce Local Persistence (Keeps user logged in even after closing PWA)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Persistence set successfully
  })
  .catch((error) => {
    console.error("Firebase Persistence Error:", error);
  });

export const db = getFirestore(app);        // Firestore database
export const storage = getStorage(app);     // Firebase Storage
export const messaging = getMessaging(app); // Firebase Messaging
export const googleProvider = new GoogleAuthProvider(); // Google Auth Provider
export const ts = serverTimestamp;          // Timestamp for docs

// Secondary Firebase app for user creation (prevents admin logout)
// This allows admins to create users without being logged out
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
