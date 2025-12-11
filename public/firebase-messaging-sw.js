// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDZazC0DmzvyH1tTD6F8XCtTNL4xnM4oBI",
    authDomain: "timestatic-77f36.firebaseapp.com",
    projectId: "timestatic-77f36",
    storageBucket: "timestatic-77f36.firebasestorage.app",
    messagingSenderId: "5099212438",
    appId: "1:5099212438:web:57281af287461b3319fcb7"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
