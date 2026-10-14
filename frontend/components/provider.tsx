'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from '@/lib/auth';
import type { Accounts } from '@/lib/auth/types';
import { api, setBearer, type Usage } from '@/lib/api';
type State = { account?: Accounts; usage?: Usage; login: () => Promise<Usage>; logout: () => void; refresh: () => Promise<void>; notice: string; notify: (s: string) => void };
const Context = createContext<State>(null!);
export const useFair = () => useContext(Context);
export function Provider({ children }: { children: ReactNode }) {
 const [account, setAccount] = useState<Accounts>(); const [usage, setUsage] = useState<Usage>(); const [notice, notify] = useState('');
 async function refresh() { if (account) setUsage(await api<Usage>(`/api/usage/${account.walletAddress}`)); }
 async function login() {
   const a = await auth.login(); const challenge = await api<{ nonce: string; message: string }>('/api/auth/challenge', { wallet: a.walletAddress });
   const signature = await a.wallet.signMessage({ account: a.wallet.account!, message: challenge.message });
   const verified = await api<{ token: string }>('/api/auth/verify', { wallet: a.walletAddress, nonce: challenge.nonce, signature }); setBearer(verified.token);
   await api('/api/onboard', { wallet: a.walletAddress }); setAccount(a); const u = await api<Usage>(`/api/usage/${a.walletAddress}`); setUsage(u); return u;
 }
 function logout() { auth.logout(); setBearer(''); setAccount(undefined); setUsage(undefined); location.href = '/'; }
 useEffect(() => { if (notice) { const timer = setTimeout(() => notify(''), 6500); return () => clearTimeout(timer); } }, [notice]);
 return <Context.Provider value={{ account, usage, login, logout, refresh, notice, notify }}>{children}{notice && <div className="toast" role="status">{notice}<button onClick={() => notify('')} aria-label="Dismiss">×</button></div>}</Context.Provider>;
}
