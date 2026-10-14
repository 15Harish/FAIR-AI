import type { AuthAdapter } from './types';
export const privy: AuthAdapter = { isSupported: () => false, async login() { throw new Error('Email sign-in is coming soon. Please continue with Face ID.'); }, async getAccounts() { throw new Error('Please sign in to continue.'); }, logout() {} };
