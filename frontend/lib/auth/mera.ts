import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, type Secp256k1SigningSession } from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { createWalletClient, http, type LocalAccount } from 'viem';
import { network } from '../chain';
import type { Accounts, AuthAdapter } from './types';
const credentialName = 'fairai.passkey';
let accounts: Accounts | undefined;
let meterSession: Secp256k1SigningSession | undefined;
function derive(prf: Uint8Array, index: number) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prf, wordlist));
  try { const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`); if (!node.privateKey) throw new Error('Could not sign in.'); return new Uint8Array(node.privateKey); } finally { seed.fill(0); }
}
function metadata() { const raw = localStorage.getItem(credentialName); return raw ? JSON.parse(raw) : undefined; }
async function root() { return getPasskeyPrfOutput({ rpId: location.hostname, credential: metadata() }); }
async function withPrimary<T>(operation: (account: LocalAccount) => Promise<T>) {
  const result = await root(); const key = derive(result.prfOutput, 0); result.prfOutput.fill(0);
  const session = createSecp256k1SigningSession({ privateKey: key }); key.fill(0);
  try { const account = toViemAccount(session); if (account.address !== accounts?.walletAddress) throw new Error('Please choose the same sign-in account.'); return await operation(account); } finally { session.end(); }
}
export const mera: AuthAdapter = {
  isSupported: () => typeof window !== 'undefined' && window.isSecureContext && !!window.PublicKeyCredential,
  async login() {
    if (!this.isSupported()) throw new Error('Use Safari or Chrome with a saved passkey to continue.');
    const known = metadata();
    const result = known ? await root() : await createPasskeyWithPrfOutput({ rp: { id: location.hostname, name: 'FairAI' }, user: { name: `fairai-${Date.now()}`, displayName: 'FairAI member' } });
    localStorage.setItem(credentialName, JSON.stringify({ credentialId: result.credentialId, ...('transports' in result ? { transports: result.transports } : {}) }));
    const primaryKey = derive(result.prfOutput, 0); const primary = createSecp256k1SigningSession({ privateKey: primaryKey }); primaryKey.fill(0);
    const walletAddress = toViemAccount(primary).address; primary.end();
    meterSession?.end(); const meterBytes = derive(result.prfOutput, 1); result.prfOutput.fill(0);
    meterSession = createSecp256k1SigningSession({ privateKey: meterBytes }); meterBytes.fill(0);
    const prompted = { address: walletAddress, type: 'local', source: 'custom', publicKey: '0x', signMessage: (args: Parameters<LocalAccount['signMessage']>[0]) => withPrimary(a => a.signMessage(args)), signTypedData: (args: any) => withPrimary(a => a.signTypedData(args)), signTransaction: (args: any, options: any) => withPrimary(a => a.signTransaction(args, options)) } as LocalAccount;
    accounts = { wallet: createWalletClient({ account: prompted, chain: network, transport: http(process.env.NEXT_PUBLIC_RPC_URL || network.rpcUrls.default.http[0]) }), walletAddress, meterKey: toViemAccount(meterSession) };
    return accounts;
  },
  async getAccounts() { if (!accounts) throw new Error('Please sign in to continue.'); return accounts; },
  logout() { meterSession?.end(); meterSession = undefined; accounts = undefined; },
};
