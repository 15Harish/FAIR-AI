import { createPublicClient, defineChain, http, type Address, type Abi } from 'viem';
import deployment from './deployments.json';
export const network = defineChain({ id: 10143, name: 'Monad Testnet', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } } });
export const publicClient = createPublicClient({ chain: network, transport: http(process.env.NEXT_PUBLIC_RPC_URL || network.rpcUrls.default.http[0]) });
export const fair = { address: deployment.FairAI.address as Address, abi: deployment.FairAI.abi as Abi };
export const inr = { address: deployment.MockINR.address as Address, abi: deployment.MockINR.abi as Abi };
export function assertDeployment() { if (/^0x0{40}$/i.test(fair.address)) throw new Error('Payments are being set up. Please try again soon.'); }
export const receiptTypes = { Receipt: [{ name: 'user', type: 'address' }, { name: 'sessionId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }] } as const;
export const domain = { name: 'FairAI', version: '1', chainId: 10143, verifyingContract: fair.address } as const;
