import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import './globals.css';
import './theme.css';
export const metadata: Metadata = { title: 'FairAI — A fairer way to AI', description: 'Pay per answer. Never more than ₹1,950 a month.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><Provider>{children}</Provider></body></html>; }
