import type { Address, LocalAccount, WalletClient } from 'viem';
export type Accounts = { wallet: WalletClient; walletAddress: Address; meterKey: LocalAccount };
export interface AuthAdapter { login(): Promise<Accounts>; logout(): void; getAccounts(): Promise<Accounts>; isSupported(): boolean; }
