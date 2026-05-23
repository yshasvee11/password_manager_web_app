export function generateIV() {
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    return iv;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(rawKey: Uint8Array, usage: KeyUsage) {
    return window.crypto.subtle.importKey(
        'raw',
        toArrayBuffer(rawKey),
        { name: 'AES-GCM' },
        false,
        [usage]
    );
}

export async function encryptVault(plaintextVault: string, rawKey: Uint8Array, iv: Uint8Array) {
    const cryptoKey = await importAesKey(rawKey, 'encrypt');
    const encodedPlaintext = new TextEncoder().encode(plaintextVault);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(encodedPlaintext)
    );
    return new Uint8Array(ciphertextBuffer);
}

export async function decryptVault(ciphertext: Uint8Array, rawKey: Uint8Array, iv: Uint8Array) {
    const cryptoKey = await importAesKey(rawKey, 'decrypt');
    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(iv) },
            cryptoKey,
            toArrayBuffer(ciphertext)
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch {
        throw new Error('Decryption failed. The master password might be wrong, or the data has been tampered with.');
    }
}

export async function encryptBytes(plaintextBytes: Uint8Array, rawKey: Uint8Array, iv: Uint8Array) {
    const cryptoKey = await importAesKey(rawKey, 'encrypt');
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        cryptoKey,
        toArrayBuffer(plaintextBytes)
    );
    return new Uint8Array(ciphertextBuffer);
}

export async function decryptBytes(ciphertextBytes: Uint8Array, rawKey: Uint8Array, iv: Uint8Array) {
    const cryptoKey = await importAesKey(rawKey, 'decrypt');
    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(iv) },
            cryptoKey,
            toArrayBuffer(ciphertextBytes)
        );
        return new Uint8Array(decryptedBuffer);
    } catch {
        throw new Error('Byte decryption failed.');
    }
}
