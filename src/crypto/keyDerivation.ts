/**
 * src/crypto/keyDerivation.js
 * Argon2id key derivation using argon2-browser.
 */

// We access argon2 from the global window object. 
// Vite has known issues bundling argon2-browser's internal WASM loader.
// We will load the script directly in index.html to bypass Vite's WASM bundler.

/**
 * Generates a cryptographically secure random salt.
 * @returns {Uint8Array} 16-byte salt
 */
export function generateSalt() {
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return salt;
}

/**
 * Generates a cryptographically secure Server Key.
 * @returns {Uint8Array} 32-byte server key
 */
export function generateServerKey() {
    const key = new Uint8Array(32);
    window.crypto.getRandomValues(key);
    return key;
}

/**
 * Derives the initial user key (K_user) from the master password and salt using Argon2id.
 * 
 * Parameters chosen to resist GPU cracking and timing attacks:
 * - time: 3 iterations
 * - mem: 65536 KB (64MB)
 * - parallelism: 4 threads
 * - hashLen: 32 bytes (256 bits)
 * 
 * @param {string} masterPassword - The user's plaintext master password
 * @param {Uint8Array} salt - 16-byte random salt
 * @returns {Promise<Uint8Array>} Derived K_user (32 bytes)
 */
export async function deriveUserKey(masterPassword: string, salt: Uint8Array) {
    try {
        if (!(window as any).argon2) {
            throw new Error("Argon2 library is not loaded. Please wait a moment.");
        }
        const result = await (window as any).argon2.hash({
            pass: masterPassword,
            salt: salt,
            time: 3,
            mem: 65536,
            hashLen: 32,
            parallelism: 4,
            type: (window as any).argon2.ArgonType.Argon2id // protects against both side-channel and GPU cracking
        });

        // result.hash is a Uint8Array
        const kUser = new Uint8Array(result.hash);

        return kUser;
    } catch (err: any) {
        throw new Error('Key derivation failed: ' + err.message, { cause: err });
    }
}

/**
 * Securely clear a Uint8Array from memory.
 * @param {Uint8Array} buffer 
 */
export function clearBuffer(buffer: any) {
    if (buffer instanceof Uint8Array || buffer instanceof ArrayBuffer) {
        new Uint8Array(buffer).fill(0);
    }
}
