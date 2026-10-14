import {encodeFunctionData,parseEventLogs,type Hex} from 'viem';
import {fair,fairAbi,read,publicClient} from './chain.js';
import {db,locked,session,type Session} from './store.js';
import {transact} from './relayerQueue.js';
export async function settleUnlocked(s:Session){
 if(s.status==='settled')return {txHash:s.txHash,charged:s.charged||'0'};
 if(s.lastSignedTotal==='0'||!s.lastSig){db.prepare("UPDATE sessions SET status='settled',charged='0' WHERE id=?").run(s.id);return {txHash:null,charged:'0'};}
 db.prepare("UPDATE sessions SET status='settling' WHERE id=?").run(s.id);
 try{
  let receipt;
  if(await read('settled',[s.id])){
   // Find the canonical event even if a previous process died after broadcast.
   const logs=await publicClient.getLogs({address:fair,fromBlock:BigInt(process.env.DEPLOY_BLOCK||'0'),toBlock:'latest'});
   const events=parseEventLogs({abi:fairAbi,logs,eventName:'SessionSettled'}) as unknown as {args:{sessionId:Hex;charged:bigint};transactionHash:Hex}[];
   const event=events.find(e=>e.args.sessionId.toLowerCase()===s.id.toLowerCase());
   if(!event)throw new Error('Settled payment event is not available yet');
   db.prepare("UPDATE sessions SET status='settled',txHash=?,charged=? WHERE id=?").run(event.transactionHash,event.args.charged.toString(),s.id);
   return {txHash:event.transactionHash,charged:event.args.charged.toString()};
  }
  receipt=await transact(`settle:${s.id}`,fair,encodeFunctionData({abi:fairAbi,functionName:'settle',args:[s.wallet,s.id,BigInt(s.lastSignedTotal),s.lastSig]}));
  const events=parseEventLogs({abi:fairAbi,logs:receipt.logs,eventName:'SessionSettled'}) as unknown as {args:{sessionId:Hex;charged:bigint}}[];
  const event=events.find(e=>e.args.sessionId.toLowerCase()===s.id.toLowerCase());if(!event)throw new Error('Missing payment event');
  const charged=event.args.charged.toString();db.prepare("UPDATE sessions SET status='settled',txHash=?,charged=? WHERE id=?").run(receipt.transactionHash,charged,s.id);
  console.info('Session paid',s.id,receipt.transactionHash);return {txHash:receipt.transactionHash,charged};
 }catch(error){db.prepare("UPDATE sessions SET status='failed',retries=retries+1,retryAt=? WHERE id=?").run(Date.now()+30000*2**s.retries,s.id);throw error;}
}
export const settle=(s:Session)=>locked(s.id,()=>{
 const current=session(s.id);
 if(!current)throw new Error('Session no longer exists');
 return settleUnlocked(current);
});
export function startSweeper(){return setInterval(()=>{
 const rows=db.prepare("SELECT * FROM sessions WHERE (status='open' AND lastActivity<?) OR (status IN ('failed','settling') AND retries<4 AND retryAt<?)").all(Date.now()-Number(process.env.IDLE_TIMEOUT_MS||300000),Date.now()) as Session[];
 for(const s of rows)void settle(s).catch(()=>console.warn('Settlement retry pending',s.id));
},30000);}
