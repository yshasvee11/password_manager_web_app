/**
 * vaultStorage.js
 * 100% Firebase Firestore storage for the encrypted vault.
 * The full AES-256-GCM ciphertext is stored in Firestore.
 * Zero-knowledge is preserved — the master password never leaves the client.
 */
import { db, auth, googleProvider, isFirebaseConfigured } from '../firebase/config.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

function vaultError(code: string, message: string) {
    return Object.assign(new Error(message), { code });
}

export async function firebaseGoogleLogin() {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    return signInWithPopup(auth, googleProvider);
}

export async function firebaseEmailLogin(email: string, pass: string) {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    return signInWithEmailAndPassword(auth, email, pass);
}

export async function firebaseEmailSignup(email: string, pass: string) {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    return createUserWithEmailAndPassword(auth, email, pass);
}

export async function firebaseLogout() {
    return signOut(auth);
}

/**
 * Saves the full encrypted vault to Firestore.
 * @param {string} userId
 * @param {{ salt, wrappedServerKey, wrappedServerKeyIv, iv, encryptedVault }} cryptoPayload - all base64 strings
 */
export async function saveVault(userId: string, cryptoPayload: any) {
    const timestamp = Date.now();

    const firestorePayload = {
        salt: cryptoPayload.salt,
        wrappedServerKey: cryptoPayload.wrappedServerKey,
        wrappedServerKeyIv: cryptoPayload.wrappedServerKeyIv,
        iv: cryptoPayload.iv,
        encryptedVault: cryptoPayload.encryptedVault,
        updatedAt: timestamp,
    };

    if (!isFirebaseConfigured || !auth.currentUser) {
        throw new Error('Not authenticated. Cannot save vault.');
    }

    await setDoc(doc(db, 'users', userId), firestorePayload);
}

/**
 * Loads the full encrypted vault from Firestore.
 * Returns all fields needed for decryption.
 * @param {string} userId
 * @returns {Promise<{ salt, wrappedServerKey, wrappedServerKeyIv, iv, encryptedVault, updatedAt }>}
 */
export async function loadVault(userId: string) {
    if (!isFirebaseConfigured || !auth.currentUser) {
        throw vaultError('vault/not-authenticated', 'Not authenticated. Cannot load vault.');
    }

    const docSnap = await getDoc(doc(db, 'users', userId));
    if (!docSnap.exists()) {
        throw vaultError('vault/not-found', 'No vault exists yet for this Google account.');
    }

    const data = docSnap.data();
    return {
        salt: data.salt,
        wrappedServerKey: data.wrappedServerKey,
        wrappedServerKeyIv: data.wrappedServerKeyIv,
        iv: data.iv,
        encryptedVault: data.encryptedVault,
        updatedAt: data.updatedAt,
    };
}
