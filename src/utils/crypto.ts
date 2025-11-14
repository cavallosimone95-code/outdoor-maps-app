// Utilizzo della Web Crypto API invece del modulo Node.js crypto
async function getKeyMaterial(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
}

async function deriveKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await getKeyMaterial(password);
    const key = await deriveKey(keyMaterial, salt);
    const hash = await window.crypto.subtle.exportKey("raw", key);
    
    return {
        hash: Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''),
        salt: Array.from(salt)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    try {
        const saltArray = new Uint8Array(salt.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
        const hashArray = new Uint8Array(hash.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
        
        const keyMaterial = await getKeyMaterial(password);
        const key = await deriveKey(keyMaterial, saltArray);
        const testHash = await window.crypto.subtle.exportKey("raw", key);
        
        const testHashHex = Array.from(new Uint8Array(testHash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        return testHashHex === hash;
    } catch (error) {
        console.error('Error verifying password:', error);
        return false;
    }
}