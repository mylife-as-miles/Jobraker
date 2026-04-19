// Fallback mechanism if no secret key is provided
const FALLBACK_SECRET = "jobraker-fallback-secret-key-32b!";

// Must be 32 bytes for AES-256-GCM
async function getKey(): Promise<CryptoKey> {
  // Use VITE_ENCRYPTION_KEY if available in browser, else Deno env if available, else fallback
  let secretString = FALLBACK_SECRET;
  
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENCRYPTION_KEY) {
    secretString = import.meta.env.VITE_ENCRYPTION_KEY;
  } else if (typeof (globalThis as any).Deno !== 'undefined') {
    // @ts-ignore
    secretString = (globalThis as any).Deno.env.get('ENCRYPTION_KEY') || FALLBACK_SECRET;
  }

  // Pad or truncate to 32 bytes
  const encoder = new TextEncoder();
  let keyData = encoder.encode(secretString);
  if (keyData.length !== 32) {
    const padded = new Uint8Array(32);
    padded.set(keyData.slice(0, 32));
    keyData = padded;
  }

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a string (e.g., JSON representation of credentials)
 * Returns a string formatted as "ivBase64:ciphertextBase64"
 */
export async function encryptSymmetric(text: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );

  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(ciphertext)}`;
}

/**
 * Decrypts a previously encrypted string in format "ivBase64:ciphertextBase64"
 */
export async function decryptSymmetric(encryptedString: string): Promise<string> {
  if (!encryptedString.includes(':')) {
    throw new Error('Invalid encrypted string format');
  }

  const parts = encryptedString.split(':');
  const ivBuffer = base64ToBuffer(parts[0]);
  const ciphertextBuffer = base64ToBuffer(parts[1]);

  const key = await getKey();
  
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer)
    },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}
