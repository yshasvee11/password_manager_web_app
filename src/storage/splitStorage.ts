import { db, auth, googleProvider, isFirebaseConfigured } from '../firebase/config.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { bufferToBase64, base64ToBuffer } from '../utils/base64.js';

const RECOVERY_PREFIX = 'vault_recovery_';

function vaultError(code, message) {
    return Object.assign(new Error(message), { code });
}

export function splitCiphertext(fullBuffer) {
    const splitIndex = Math.ceil(fullBuffer.length * 0.6);
    return {
        remotePart: fullBuffer.slice(0, splitIndex),
        localPart: fullBuffer.slice(splitIndex),
        splitIndex,
    };
}

export function reassembleCiphertext(remotePart, localPart) {
    const full = new Uint8Array(remotePart.length + localPart.length);
    full.set(remotePart, 0);
    full.set(localPart, remotePart.length);
    return full;
}

export async function firebaseGoogleLogin() {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured.');
    return signInWithPopup(auth, googleProvider);
}

export async function firebaseLogout() {
    return signOut(auth);
}

function localKey(userId) {
    return `vault_local_${userId}`;
}

function recoveryKey(userId) {
    return `${RECOVERY_PREFIX}${userId}`;
}

export function exportRecoveryPackage(userId) {
    const localStored = localStorage.getItem(localKey(userId));
    if (!localStored) throw new Error('No local shard found to export.');
    const parsed = JSON.parse(localStored);
    return JSON.stringify({ version: 1, userId, ...parsed });
}

export function importRecoveryPackage(userId, recoveryJson) {
    let parsed;
    try {
        parsed = JSON.parse(recoveryJson);
    } catch {
        throw new Error('Invalid recovery package format.');
    }
    if (parsed.userId !== userId) throw new Error('Recovery package user does not match current account.');
    if (!parsed.encryptedVaultLocal || typeof parsed.splitIndex !== 'number') throw new Error('Recovery package is missing required fields.');
    localStorage.setItem(localKey(userId), JSON.stringify({
        encryptedVaultLocal: parsed.encryptedVaultLocal,
        splitIndex: parsed.splitIndex,
        updatedAt: parsed.updatedAt || Date.now(),
    }));
    localStorage.setItem(recoveryKey(userId), JSON.stringify({
        version: 1,
        userId,
        encryptedVaultLocal: parsed.encryptedVaultLocal,
        splitIndex: parsed.splitIndex,
        updatedAt: parsed.updatedAt || Date.now(),
    }));
}

export async function saveVaultSplit(userId, cryptoPayload) {
    const fullCiphertext = base64ToBuffer(cryptoPayload.encryptedVault);
    const { remotePart, localPart, splitIndex } = splitCiphertext(fullCiphertext);
    const timestamp = Date.now();

    const remotePayload = {
        salt: cryptoPayload.salt,
        wrappedServerKey: cryptoPayload.wrappedServerKey,
        wrappedServerKeyIv: cryptoPayload.wrappedServerKeyIv,
        iv: cryptoPayload.iv,
        encryptedVaultRemote: bufferToBase64(remotePart),
        splitIndex,
        updatedAt: timestamp,
    };

    const localPayload = {
        encryptedVaultLocal: bufferToBase64(localPart),
        splitIndex,
        updatedAt: timestamp,
    };

    if (isFirebaseConfigured && auth.currentUser) {
        await setDoc(doc(db, 'users', userId), remotePayload);
    } else {
        localStorage.setItem(`vault_remote_${userId}`, JSON.stringify(remotePayload));
    }

    localStorage.setItem(localKey(userId), JSON.stringify(localPayload));
    localStorage.setItem(recoveryKey(userId), JSON.stringify({ version: 1, userId, ...localPayload }));
}

export async function loadVaultSplit(userId) {
    let remoteData;

    if (isFirebaseConfigured && auth.currentUser) {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (!docSnap.exists()) {
            throw vaultError('vault/not-found', 'No vault exists yet for this Google account.');
        }
        remoteData = docSnap.data();
    } else {
        const stored = localStorage.getItem(`vault_remote_${userId}`);
        if (!stored) throw vaultError('vault/not-found', 'No vault found.');
        remoteData = JSON.parse(stored);
    }

    let localStored = localStorage.getItem(localKey(userId));
    if (!localStored) {
        const recoveryCopy = localStorage.getItem(recoveryKey(userId));
        if (recoveryCopy) {
            localStorage.setItem(localKey(userId), recoveryCopy);
            localStored = recoveryCopy;
        }
    }

    if (!localStored) {
        throw vaultError('vault/local-shard-missing', 'Local vault shard missing. Import your recovery package to continue.');
    }

    const localData = JSON.parse(localStored);
    const remotePart = base64ToBuffer(remoteData.encryptedVaultRemote);
    const localPart = base64ToBuffer(localData.encryptedVaultLocal);
    const fullCiphertext = reassembleCiphertext(remotePart, localPart);

    return {
        salt: remoteData.salt,
        wrappedServerKey: remoteData.wrappedServerKey,
        wrappedServerKeyIv: remoteData.wrappedServerKeyIv,
        iv: remoteData.iv,
        encryptedVault: bufferToBase64(fullCiphertext),
        updatedAt: remoteData.updatedAt,
    };
}
