
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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

async function checkUsers() {
    console.log("Checking Users for Admin Permissions...");
    try {
        const snapshot = await getDocs(collection(db, "users"));

        console.log(`Found ${snapshot.size} users.`);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`\nUser: ${data.name} (${data.email})`);
            console.log(`  Uid: ${doc.id}`); // This is likely the Auth UID if strictly mapped
            console.log(`  Role: ${data.role}`);
            console.log(`  OrgId: ${data.orgId}`);

            if (data.role === 'admin' && !data.orgId) {
                console.warn("  [WARNING] Admin user missing orgId!");
            }
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

checkUsers();
