/**
 * src/firebase/config.example.js
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy .env.example to .env in the frontend/ directory
 * 2. Fill in your Firebase project credentials in .env
 * 3. The app reads credentials from environment variables automatically
 * 
 * This file exists only as a reference for the config structure.
 * The actual config.js reads from import.meta.env (Vite env variables).
 * 
 * Never commit real API keys to source control.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

let app, db, auth;

if (hasConfig) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

export { db, auth };
export const isFirebaseConfigured = !!hasConfig;
