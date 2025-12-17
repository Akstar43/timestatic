
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, orderBy } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyDZazC0DmzvyH1tTD6F8XCtTNL4xnM4oBI",
    authDomain: "timestatic-77f36.firebaseapp.com",
    projectId: "timestatic-77f36",
    storageBucket: "timestatic-77f36.firebasestorage.app",
    messagingSenderId: "5099212438",
    appId: "1:5099212438:web:57281af287461b3319fcb7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkNotifications() {
    console.log("Fetching notifications...");
    try {
        const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        console.log(`Found ${snapshot.size} notifications.`);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const time = data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : "N/A";
            console.log(`[${doc.id}] ${time} | ${data.message} | Org: ${data.orgId} | Type: ${data.type}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

checkNotifications();
