
// This file is intentionally left blank. 
// It's required for Firebase Cloud Messaging to work.
// You can add custom background message handling logic here if needed.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const firebaseConfig = {
  "projectId": "studio-8025635453-a4860",
  "appId": "1:8096780200:web:a5eb539594b5608314979d",
  "storageBucket": "studio-8025635453-a4860.appspot.com",
  "apiKey": "AIzaSyDS9a7kdaxG0bnk0SGbszoRQPJgJL29gu8",
  "authDomain": "studio-8025635453-a4860.firebaseapp.com",
  "messagingSenderId": "8096780200"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
