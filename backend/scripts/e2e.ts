import 'dotenv/config';
import assert from 'node:assert/strict';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {createWalletClient,http,encodeFunctionData,parseEventLogs} from 'viem';
import {publicClient,chain,fair,fairAbi,inr,inrAbi,usage,read} from '../src/chain.js';
import {domain,types} from '../src/receipts.js';
const base=process.env.E2E_BACKEND_URL||'http://localhost:3001';
const account=privateKeyToAccount(generatePrivateKey()),meter=privateKeyToAccount(generatePrivateKey());
const client=createWalletClient({account,chain,transport:http()});let token='';
async function api(path:string,body?:unknown){const response=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined});const data=await response.json() as any;if(!response.ok)throw new Error(`${path}: ${data.message}`);return data;}
async function send(to:`0x${string}`,data:`0x${string}`){const gas=await publicClient.estimateGas({account,to,data});const hash=await client.sendTransaction({to,data,gas:gas+2000n});const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt;}
const challenge=await api('/auth/challenge',{wallet:account.address});
token=(await api('/auth/verify',{wallet:account.address,nonce:challenge.nonce,signature:await account.signMessage({message:challenge.message})})).token;
await api('/onboard',{wallet:account.address});assert.equal((await api('/onboard',{wallet:account.address})).alreadyOnboarded,true);
await send(inr,encodeFunctionData({abi:inrAbi,functionName:'approve',args:[fair,200n*10n**18n]}));
await send(fair,encodeFunctionData({abi:fairAbi,functionName:'depositAndSetKey',args:[200n*10n**18n,meter.address]}));
const {sessionId}=await api('/session/start',{wallet:account.address});let receipt:any=null,total=0n;
for(const message of ['Explain a binary search in one sentence.','Give a tiny example.','Name one common mistake.']){
 const response=await fetch(base+'/api/chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId,message,receipt})});assert.equal(response.status,200);const lines=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));const done=lines.find(item=>item.type==='done');assert.ok(done,'Chat did not finish');total+=BigInt(done.cost);assert.equal(BigInt(done.newTotal),total);
 receipt={amount:done.newTotal,signature:await meter.signTypedData({domain,types,primaryType:'Receipt',message:{user:account.address,sessionId,amount:total}})};await api('/session/receipt',{sessionId,receipt});
}
const result=await api('/session/end',{sessionId,receipt});assert.equal(BigInt(result.charged),total);
const paid=await publicClient.getTransactionReceipt({hash:result.txHash});const events=parseEventLogs({abi:fairAbi,logs:paid.logs,eventName:'SessionSettled'}) as unknown as {args:{charged:bigint}}[];assert.equal(events[0].args.charged,total);
await send(fair,encodeFunctionData({abi:fairAbi,functionName:'requestWithdraw'}));
const ready=(await usage(account.address)).withdrawReadyAt;while((await publicClient.getBlock()).timestamp<ready)await new Promise(resolve=>setTimeout(resolve,5000));
await send(fair,encodeFunctionData({abi:fairAbi,functionName:'withdraw'}));assert.equal(await read('balance',[account.address]),0n);console.info('End-to-end flow passed',result.txHash);
