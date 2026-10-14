export const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
let bearer = '';
export function setBearer(value: string) { bearer = value; }
export function getBearer() { return bearer; }
export class ApiError extends Error { constructor(public code: string, message: string) { super(message); } }
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(backend + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); if (!response.ok) throw new ApiError(data.error, data.message || 'Something went wrong. Please try again.'); return data;
}
export type Usage = { balance: string; spentThisMonth: string; cap: string; withdrawReadyAt: string; hasKey: boolean; onboarded: boolean };
export type Receipt = { amount: string; signature: `0x${string}` };
export type Session = { id?: string; sessionId?: `0x${string}`; pendingTotal: string; lastSignedTotal?: string; lastSig?: `0x${string}`; status?: string; messages?: { role: string; content: string }[] };
export function money(wei: string | bigint) { const paise = (BigInt(wei) + 5_000_000_000_000_000n) / 10_000_000_000_000_000n; return '₹' + (paise / 100n).toLocaleString('en-IN') + '.' + (paise % 100n).toString().padStart(2, '0'); }
export function friendly(error: unknown) { if (error instanceof ApiError) return error.message; return 'Unable to complete that step. Please retry, or check your connection.'; }
