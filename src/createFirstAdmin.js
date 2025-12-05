// TEMPORARY ADMIN SETUP SCRIPT
// This script helps you create your first admin user
// Run this in the browser console when on the login page

import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase/firebase";

async function createFirstAdmin() {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        console.error("❌ You must be logged in first!");
        console.log("1. Try logging in with Google Sign-In");
        console.log("2. Then run this script again");
        return;
    }

    console.log("Creating admin user for:", currentUser.email);

    try {
        await addDoc(collection(db, "users"), {
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName || currentUser.email.split('@')[0],
            role: "admin",
            leaveDaysAssigned: 0,
            workingDays: [],
            organizationName: "",
            photoURL: currentUser.photoURL || "",
            createdAt: serverTimestamp()
        });

        console.log("✅ Admin user created successfully!");
        console.log("Now refresh the page and try logging in as admin");
    } catch (error) {
        console.error("❌ Error creating admin user:", error);
    }
}

// Run the function
createFirstAdmin();
