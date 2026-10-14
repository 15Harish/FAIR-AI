import { api, backend, getBearer, type Receipt } from './api';
let active: { sessionId: `0x${string}`; receipt?: Receipt } | undefined;
export const setActive = (value: typeof active) => { active = value; };
export const getActive = () => active;
export async function endActive() { if (!active) return undefined; const current = active; const result = await api<{ txHash?: string; charged: string }>('/api/session/end', current); if (active === current) active = undefined; return result; }
export function beaconEnd() { if (!active) return; navigator.sendBeacon(backend + '/api/session/end', new Blob([JSON.stringify({ ...active, authToken: getBearer() })], { type: 'text/plain' })); }
