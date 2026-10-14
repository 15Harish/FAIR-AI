import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPublicClient,createWalletClient,defineChain,http,isAddress,zeroAddress,type Address,type Abi,type Hex } from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
const deployment = JSON.parse(readFileSync(resolve(process.cwd(),'../shared/deployments.json'),'utf8'));
export const chain=defineChain({id:10143,name:'Monad Testnet',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:[process.env.MONAD_RPC||'https://testnet-rpc.monad.xyz']}}});
export const fair=(process.env.FAIRAI_ADDRESS||deployment.FairAI.address) as Address;
export const inr=(process.env.MOCKINR_ADDRESS||deployment.MockINR.address) as Address;
export const fairAbi=deployment.FairAI.abi as Abi, inrAbi=deployment.MockINR.abi as Abi;
if (!isAddress(fair)||!isAddress(inr)||fair===zeroAddress||inr===zeroAddress) throw new Error('Deploy contracts and populate shared/deployments.json first');
if(!process.env.RELAYER_PRIVATE_KEY) throw new Error('RELAYER_PRIVATE_KEY is required');
export const account=privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as Hex);
export const publicClient=createPublicClient({chain,transport:http()});
export const relayer=createWalletClient({account,chain,transport:http()});
export async function read(name:string,args:readonly unknown[]=[]):Promise<unknown>{return publicClient.readContract({address:fair,abi:fairAbi,functionName:name,args});}
export async function usage(wallet:Address){const [balance,spent,ready,key,requested] = await Promise.all([read('balance',[wallet]),read('spentThisMonth',[wallet]),read('withdrawReadyAt',[wallet]),read('meterKey',[wallet]),read('withdrawRequestedAt',[wallet])]);return {balance:balance as bigint,spentThisMonth:spent as bigint,withdrawReadyAt:ready as bigint,meterKey:key as Address,requested:requested as bigint};}
