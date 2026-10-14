import {recoverTypedDataAddress,type Hex} from 'viem';
import {fair,usage} from './chain.js';
import {CAP} from './pricing.js';
import {db,type Session} from './store.js';
export const types={Receipt:[{name:'user',type:'address'},{name:'sessionId',type:'bytes32'},{name:'amount',type:'uint256'}]} as const;
export const domain={name:'FairAI',version:'1',chainId:10143,verifyingContract:fair} as const;
export function fail(code:string,message:string,status=402):never{throw Object.assign(new Error(message),{code,status});}
export async function acceptReceipt(s:Session,receipt:unknown,checkBalance=true){
 const r=receipt as {amount?:string;signature?:Hex}|undefined;
 if(!r)fail('RECEIPT_REQUIRED','Please confirm the previous answer before continuing.');
 if(typeof r.amount!=='string'||!/^\d+$/.test(r.amount)||r.amount!==s.pendingTotal||typeof r.signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(r.signature))fail('BAD_RECEIPT','Please retry confirming your answer.');
 let signer:string;try{signer=await recoverTypedDataAddress({domain,types,primaryType:'Receipt',message:{user:s.wallet,sessionId:s.id,amount:BigInt(r.amount)},signature:r.signature});}catch{fail('BAD_RECEIPT','Please retry confirming your answer.');}
 const u=await usage(s.wallet);
 if(signer.toLowerCase()!==s.meterKey.toLowerCase()||signer.toLowerCase()!==u.meterKey.toLowerCase())fail('BAD_RECEIPT','Please sign in again to confirm your answer.');
 const remaining=CAP>u.spentThisMonth?CAP-u.spentThisMonth:0n;
 if(checkBalance&&(BigInt(r.amount)<remaining?BigInt(r.amount):remaining)>u.balance)fail('INSUFFICIENT_BALANCE','Add balance to keep chatting.');
 db.prepare('UPDATE sessions SET lastSignedTotal=?,lastSig=?,lastActivity=? WHERE id=?').run(r.amount,r.signature,Date.now(),s.id);
 s.lastSignedTotal=r.amount;s.lastSig=r.signature;
}
