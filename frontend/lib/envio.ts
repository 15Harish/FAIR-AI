import { api } from './api';
export type HistorySession = { id: string; requested: string; charged: string; timestamp: number; txHash?: string; free?: boolean; status?: string };
export type Day = { day: string; amount: string; sessions?: number };
export type History = { sessions: HistorySession[]; days: Day[]; source: 'indexer' | 'direct' };
export const historyQuery = `query History($user: String!, $since: String!, $month: numeric!) {
 Session(where: {user: {_eq: $user}}, order_by: {timestamp: desc}, limit: 100) { id requested charged free timestamp txHash }
 DailySpend(where: {user: {_eq: $user}, day: {_gte: $since}}, order_by: {day: asc}) { day amount sessions }
 MonthlySpend(where: {user: {_eq: $user}, month: {_eq: $month}}) { amount month }
}`;
export async function history(user: string): Promise<History> {
 const url = process.env.NEXT_PUBLIC_ENVIO_URL;
 if (url) try { const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10).replaceAll('-', ''); const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: historyQuery, variables: { user: user.toLowerCase(), since, month: Math.floor(Date.now() / 2592000000) } }) }); const result = await response.json(); if (!response.ok || result.errors) throw new Error('History unavailable'); return { sessions: result.data.Session.map((s: HistorySession) => ({ ...s, timestamp: Number(s.timestamp) * 1000 })), days: result.data.DailySpend, source: 'indexer' }; } catch { /* Use authoritative payment summary and persisted receipts when indexing is unavailable. */ }
 const result = await api<{ sessions: { id: string; requested: string; charged: string | null; startedAt: number; txHash?: string; status: string }[] }>(`/api/sessions/${user}`);
 const sessions: HistorySession[] = result.sessions.map(s => ({ ...s, charged: s.charged || '0', timestamp: s.startedAt, free: s.status === 'settled' && BigInt(s.requested) > 0n && BigInt(s.charged || '0') === 0n }));
 const days = new Map<string, bigint>(); for (const s of sessions) { const day = new Date(s.timestamp).toISOString().slice(0, 10).replaceAll('-', ''); days.set(day, (days.get(day) || 0n) + BigInt(s.charged)); }
 return { sessions, days: [...days].map(([day, amount]) => ({ day, amount: amount.toString() })), source: 'direct' };
}
