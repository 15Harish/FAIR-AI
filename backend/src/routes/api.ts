import {randomBytes} from 'node:crypto';
import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {encodeFunctionData,parseEther,zeroAddress,type Address} from 'viem';
import {account,publicClient,usage,inr,inrAbi} from '../chain.js';
import {db,session,locked,type Session} from '../store.js';
import {acceptReceipt,fail} from '../receipts.js';
import {CAP,costWei} from '../pricing.js';
import {transact} from '../relayerQueue.js';
import {settle,settleUnlocked} from '../sweeper.js';
import {streamQwen} from '../qwen.js';
import {authenticate,address} from './auth.js';
export const api=Router();
api.get('/health',async(_req,res)=>res.json({ok:true,relayerMon:(await publicClient.getBalance({address:account.address})).toString()}));
api.use(authenticate);
const walletLimit=rateLimit({windowMs:60000,limit:20,keyGenerator:(_req,res)=>res.locals.wallet,standardHeaders:true,legacyHeaders:false,message:{error:'RATE_LIMITED',message:'Please wait a moment and retry.'}});
function own(wallet:unknown,authorized:Address){const parsed=address(wallet);if(parsed!==authorized)fail('FORBIDDEN','This account is not signed in.',403);return parsed;}
function ownSession(id:unknown,wallet:Address){if(typeof id!=='string'||!/^0x[0-9a-f]{64}$/i.test(id))fail('INVALID_SESSION','Please start a new conversation.',400);const s=session(id);if(!s)fail('NOT_FOUND','Please start a new conversation.',404);if(s.wallet!==wallet)fail('FORBIDDEN','This conversation belongs to another account.',403);return s;}
api.post('/onboard',walletLimit,async(req,res)=>{const wallet=own(req.body.wallet,res.locals.wallet);const result=await locked(`onboard:${wallet}`,async()=>{
 let row=db.prepare('SELECT * FROM onboarded WHERE wallet=?').get(wallet) as {txMon:string|null;txMint:string|null;at:number|null}|undefined;
 if(row?.at)return {ok:true,alreadyOnboarded:true};
 db.prepare('INSERT OR IGNORE INTO onboarded(wallet) VALUES(?)').run(wallet);
 if(!row?.txMon){const receipt=await transact(`welcome-mon:${wallet}`,wallet,'0x',parseEther('0.05'));db.prepare('UPDATE onboarded SET txMon=? WHERE wallet=?').run(receipt.transactionHash,wallet);}
 if(!row?.txMint){const receipt=await transact(`welcome-inr:${wallet}`,inr,encodeFunctionData({abi:inrAbi,functionName:'mint',args:[wallet,500n*10n**18n]}));db.prepare('UPDATE onboarded SET txMint=? WHERE wallet=?').run(receipt.transactionHash,wallet);}
 db.prepare('UPDATE onboarded SET at=? WHERE wallet=?').run(Date.now(),wallet);return {ok:true,alreadyOnboarded:false};
 });res.json(result);});
api.get('/usage/:wallet',async(req,res)=>{const wallet=own(req.params.wallet,res.locals.wallet),u=await usage(wallet);res.json({balance:u.balance.toString(),spentThisMonth:u.spentThisMonth.toString(),cap:CAP.toString(),withdrawReadyAt:u.withdrawReadyAt.toString(),hasKey:u.meterKey!==zeroAddress,onboarded:!!db.prepare('SELECT at FROM onboarded WHERE wallet=? AND at IS NOT NULL').get(wallet)});});
api.get('/sessions/:wallet',(req,res)=>{const wallet=own(req.params.wallet,res.locals.wallet);res.json({sessions:db.prepare("SELECT id,startedAt,txHash,lastSignedTotal AS requested,charged,status FROM sessions WHERE wallet=? ORDER BY startedAt DESC LIMIT 100").all(wallet)});});
api.get('/session/current/:wallet',(req,res)=>{const wallet=own(req.params.wallet,res.locals.wallet);const s=db.prepare("SELECT * FROM sessions WHERE wallet=? AND status='open' ORDER BY startedAt DESC LIMIT 1").get(wallet) as Session|undefined;res.json({session:s?{...s,messages:db.prepare('SELECT role,content,at FROM messages WHERE sessionId=? ORDER BY at').all(s.id)}:null});});
api.post('/session/start',async(req,res)=>{const wallet=own(req.body.wallet,res.locals.wallet);const result=await locked(`start:${wallet}`,async()=>{
 const old=db.prepare("SELECT * FROM sessions WHERE wallet=? AND status IN ('open','settling','failed')").all(wallet) as Session[];for(const s of old)await settle(s);
 const u=await usage(wallet);if(u.balance===0n)fail('INSUFFICIENT_BALANCE','Add balance to start chatting.');if(u.meterKey===zeroAddress)fail('NO_KEY','Add balance to complete your setup.',409);if(u.requested>0n)fail('WITHDRAW_PENDING','Complete your refund before starting a conversation.',409);
 const id=`0x${randomBytes(32).toString('hex')}`;db.prepare('INSERT INTO sessions(id,wallet,meterKey,startedAt,lastActivity) VALUES(?,?,?,?,?)').run(id,wallet,u.meterKey,Date.now(),Date.now());return {sessionId:id};});res.json(result);});
api.post('/session/receipt',async(req,res)=>{const s=ownSession(req.body.sessionId,res.locals.wallet);await locked(s.id,async()=>{const s=ownSession(req.body.sessionId,res.locals.wallet);if(s.status!=='open')fail('SESSION_CLOSED','Please start a new conversation.',409);await acceptReceipt(s,req.body.receipt,false);});res.json({ok:true});});
api.post('/session/end',async(req,res)=>{const s=ownSession(req.body.sessionId,res.locals.wallet);const result=await locked(s.id,async()=>{const s=ownSession(req.body.sessionId,res.locals.wallet);if(s.status==='open'&&req.body.receipt)await acceptReceipt(s,req.body.receipt,false);return settleUnlocked(s);});res.json(result);});
api.post('/chat',walletLimit,async(req,res)=>{const s=ownSession(req.body.sessionId,res.locals.wallet);if(typeof req.body.message!=='string'||!req.body.message.trim()||req.body.message.length>16000)fail('INVALID_MESSAGE','Please enter a shorter message.',400);
 await locked(s.id,async()=>{
 const s=ownSession(req.body.sessionId,res.locals.wallet);
 if(s.status!=='open')fail('SESSION_CLOSED','Please start a new conversation.',409);
 if(s.pendingTotal!=='0')await acceptReceipt(s,req.body.receipt);
 const u=await usage(s.wallet);if(u.balance===0n&&u.spentThisMonth<CAP)fail('INSUFFICIENT_BALANCE','Add balance to keep chatting.');
 const context=(db.prepare('SELECT role,content FROM messages WHERE sessionId=? ORDER BY at DESC LIMIT 20').all(s.id) as {role:string;content:string}[]).reverse();context.push({role:'user',content:req.body.message.trim()});
 res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
 const write=(item:unknown)=>{if(!res.destroyed)res.write(JSON.stringify(item)+'\n');};
 try{
 const result=await streamQwen(context,text=>write({type:'delta',text}));const cost=costWei(result.input,result.output);const total=BigInt(s.pendingTotal)+cost;
 db.transaction(()=>{const insert=db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?)');insert.run(s.id,'user',req.body.message.trim(),result.input,0,'0',Date.now());insert.run(s.id,'assistant',result.text,0,result.output,cost.toString(),Date.now()+1);db.prepare('UPDATE sessions SET pendingTotal=?,lastActivity=? WHERE id=?').run(total.toString(),Date.now(),s.id);})();
 write({type:'done',cost:cost.toString(),newTotal:total.toString(),spentThisMonth:u.spentThisMonth.toString(),cap:CAP.toString(),free:u.spentThisMonth>=CAP});
 }catch{write({type:'error',error:'AI_UNAVAILABLE',message:'The answer could not be completed. Please retry.'});}finally{res.end();}
 });});
