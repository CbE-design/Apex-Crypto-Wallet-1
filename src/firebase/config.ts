export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-8025635453-a4860',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:8096780200:web:a5eb539594b5608314979d',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-8025635453-a4860.appspot.com',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDS9a7kdaxG0bnk0SGbszoRQPJgJL29gu8',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'studio-8025635453-a4860.firebaseapp.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '8096780200',
};