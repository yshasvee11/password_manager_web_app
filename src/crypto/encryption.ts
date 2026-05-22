export function generateIV() {
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    return iv;
}

async function importAesKey(rawKey, usage) {
    return window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        [usage]
    );
}

export async function encryptVault(plaintextVault, rawKey, iv) {
    const cryptoKey = await importAesKey(rawKey, 'encrypt');
    const encodedPlaintext = new TextEncoder().encode(plaintextVault);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedPlaintext
    );
    return new Uint8Array(ciphertextBuffer);
}

export async function decryptVault(ciphertext, rawKey, iv) {
    const cryptoKey = await importAesKey(rawKey, 'decrypt');
    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            ciphertext
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch {
        throw new Error('Decryption failed. The master password might be wrong, or the data has been tampered with.');
    }
}

export async function encryptBytes(plaintextBytes, rawKey, iv) {
    const cryptoKey = await importAesKey(rawKey, 'encrypt');
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        plaintextBytes
    );
    return new Uint8Array(ciphertextBuffer);
}

export async function decryptBytes(ciphertextBytes, rawKey, iv) {
    const cryptoKey = await importAesKey(rawKey, 'decrypt');
    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            ciphertextBytes
        );
        return new Uint8Array(decryptedBuffer);
    } catch {
        throw new Error('Byte decryption failed.');
    }
}
