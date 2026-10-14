import { keccak256,type Hex,type Address,type TransactionReceipt } from 'viem';
import {account,publicClient,relayer} from './chain.js';
import {db} from './store.js';
let tail:Promise<unknown>=Promise.resolve();
export function queued<T>(fn:()=>Promise<T>):Promise<T> {const job=tail.then(fn,fn);tail=job.catch(()=>{});return job;}
// Sign and durably store before broadcasting. Retrying rebroadcasts identical bytes,
// including the nonce, so a crash cannot duplicate a welcome credit.
export async function transact(id:string,to:Address,data:Hex='0x',value=0n):Promise<TransactionReceipt>{return queued(async()=>{
  let row=db.prepare('SELECT * FROM relayer_transactions WHERE id=?').get(id) as {raw:Hex;hash:Hex;status:string}|undefined;
  if(!row){
    const pending=db.prepare("SELECT raw,hash FROM relayer_transactions WHERE status='prepared'").all() as {raw:Hex;hash:Hex}[];
    for(const previous of pending){
      try{await publicClient.sendRawTransaction({serializedTransaction:previous.raw});}catch{}
      const priorReceipt=await publicClient.waitForTransactionReceipt({hash:previous.hash,timeout:120000});
      db.prepare('UPDATE relayer_transactions SET status=? WHERE hash=?').run(priorReceipt.status==='success'?'confirmed':'reverted',previous.hash);
    }
    const estimate=await publicClient.estimateGas({account,to,data,value});
    const request=await relayer.prepareTransactionRequest({account,to,data,value,gas:estimate+2000n,nonce:await publicClient.getTransactionCount({address:account.address,blockTag:'pending'})});
    const raw=await relayer.signTransaction(request);row={raw,hash:keccak256(raw),status:'prepared'};
    db.prepare('INSERT INTO relayer_transactions(id,raw,hash) VALUES(?,?,?)').run(id,raw,row.hash);
  }
  let receipt:TransactionReceipt|undefined;
  try {receipt=await publicClient.getTransactionReceipt({hash:row.hash});}catch{}
  if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:row.raw});}catch(error){
    // A broadcast can time out after acceptance. Wait for this exact hash; never sign a replacement.
    console.warn('Broadcast pending for',id,row.hash);
  }receipt=await publicClient.waitForTransactionReceipt({hash:row.hash,timeout:120000});}
  if(receipt.status!=='success'){db.prepare("UPDATE relayer_transactions SET status='reverted' WHERE id=?").run(id);throw new Error(`Payment failed: ${row.hash}`);}
  db.prepare("UPDATE relayer_transactions SET status='confirmed' WHERE id=?").run(id);return receipt;
});}
