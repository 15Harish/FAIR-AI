import {randomBytes} from 'node:crypto';
import {Router,type Request,type Response,type NextFunction} from 'express';
import {isAddress,type Address,type Hex} from 'viem';
import {db} from '../store.js';
import {publicClient} from '../chain.js';
import {fail} from '../receipts.js';
export const authRouter=Router();
export function address(value:unknown):Address {if(typeof value!=='string'||!isAddress(value))fail('INVALID_ACCOUNT','Please sign in again.',400);return value.toLowerCase() as Address;}
authRouter.post('/challenge',(req,res)=>{const wallet=address(req.body.wallet),nonce=randomBytes(32).toString('hex');const expires=Date.now()+300000;const message=`FairAI sign in\nAccount: ${wallet}\nNonce: ${nonce}\nExpires: ${new Date(expires).toISOString()}\nOrigin: ${process.env.FRONTEND_ORIGIN||'http://localhost:3000'}`;db.prepare('INSERT INTO challenges VALUES(?,?,?,?)').run(nonce,wallet,message,expires);res.json({nonce,message});});
authRouter.post('/verify',async(req,res)=>{const wallet=address(req.body.wallet);const challenge=db.prepare('SELECT * FROM challenges WHERE nonce=?').get(req.body.nonce) as {wallet:string;message:string;expires:number}|undefined;
 if(!challenge||challenge.wallet!==wallet||challenge.expires<Date.now())fail('AUTH_REQUIRED','Please sign in again.',401);
 let valid=false;try{valid=await publicClient.verifyMessage({address:wallet,message:challenge.message,signature:req.body.signature as Hex});}catch{}
 if(!valid)fail('AUTH_REQUIRED','Please sign in again.',401);
 const result=db.prepare('DELETE FROM challenges WHERE nonce=?').run(req.body.nonce);if(result.changes!==1)fail('AUTH_REQUIRED','Please sign in again.',401);
 const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO auth VALUES(?,?,?)').run(token,wallet,Date.now()+86400000);res.json({token,expiresAt:Date.now()+86400000});
});
export function authenticate(req:Request,res:Response,next:NextFunction){const token=req.headers.authorization?.replace(/^Bearer /,'')||req.body?.authToken;const row=typeof token==='string'?db.prepare('SELECT wallet FROM auth WHERE token=? AND expires>?').get(token,Date.now()) as {wallet:Address}|undefined:undefined;if(!row)return res.status(401).json({error:'AUTH_REQUIRED',message:'Please sign in again.'});res.locals.wallet=row.wallet;next();}
