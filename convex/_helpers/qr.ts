// Reusable HMAC-SHA256 QR signing using Web Crypto API (Convex V8 runtime compatible).
// Each event has its own secret — never a global HMAC secret.
// QR data format: TOCK:{ticketId}:{hexSignature}

export async function signTicketQr(ticketId: string, hmacSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ticketId));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

export function buildQrData(ticketId: string, signature: string): string {
  return `TOCK:${ticketId}:${signature}`;
}
