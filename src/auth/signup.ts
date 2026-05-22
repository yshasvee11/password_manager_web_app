import { generateSalt, generateServerKey, deriveUserKey, clearBuffer } from '../crypto/keyDerivation.js';
import { computeFinalKey } from '../crypto/hash.js';
import { generateIV, encryptVault, encryptBytes } from '../crypto/encryption.js';
import { bufferToBase64 } from '../utils/base64.js';

export async function performSignupCryptoFlow(masterPassword) {
    try {
        const salt = generateSalt();
        const serverKey = generateServerKey();
        const kUser = await deriveUserKey(masterPassword, salt);
        const kFinal = await computeFinalKey(kUser, serverKey);

        const emptyVault = JSON.stringify({ items: [] });
        const iv = generateIV();
        const encryptedVaultBuffer = await encryptVault(emptyVault, kFinal, iv);

        const wrappedServerKeyIv = generateIV();
        const wrappedServerKey = await encryptBytes(serverKey, kUser, wrappedServerKeyIv);

        clearBuffer(serverKey);
        clearBuffer(kUser);
        clearBuffer(kFinal);

        return {
            salt: bufferToBase64(salt),
            wrappedServerKey: bufferToBase64(wrappedServerKey),
            wrappedServerKeyIv: bufferToBase64(wrappedServerKeyIv),
            iv: bufferToBase64(iv),
            encryptedVault: bufferToBase64(encryptedVaultBuffer)
        };
    } catch {
        throw new Error('Failed to create secure vault. Please try again.');
    }
}
