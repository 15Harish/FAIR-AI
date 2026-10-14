import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const path = process.env.SQLITE_PATH || './data/fairai.sqlite';
mkdirSync(dirname(path),{recursive:true});
export const db = new Database(path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS onboarded(wallet TEXT PRIMARY KEY, txMon TEXT, txMint TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,wallet TEXT NOT NULL,meterKey TEXT NOT NULL,startedAt INTEGER,lastActivity INTEGER,pendingTotal TEXT DEFAULT '0',lastSignedTotal TEXT DEFAULT '0',lastSig TEXT,status TEXT DEFAULT 'open',txHash TEXT,charged TEXT,retries INTEGER DEFAULT 0,retryAt INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages(sessionId TEXT, role TEXT,content TEXT,inTokens INTEGER,outTokens INTEGER,costWei TEXT,at INTEGER);
CREATE INDEX IF NOT EXISTS sessions_wallet ON sessions(wallet,status);
CREATE TABLE IF NOT EXISTS challenges(nonce TEXT PRIMARY KEY,wallet TEXT,message TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY,wallet TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS relayer_transactions(id TEXT PRIMARY KEY,raw TEXT NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'prepared');`);
export interface Session {id:`0x${string}`;wallet:`0x${string}`;meterKey:`0x${string}`;startedAt:number;lastActivity:number;pendingTotal:string;lastSignedTotal:string;lastSig:`0x${string}`|null;status:string;txHash:`0x${string}`|null;charged:string|null;retries:number;retryAt:number}
export function session(id:string) { return db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as Session|undefined; }
export const locks = new Set<string>();
export async function locked<T>(key:string,task:()=>Promise<T>):Promise<T> { if(locks.has(key)) throw Object.assign(new Error('An action is already in progress. Please retry.'),{status:409,code:'BUSY'}); locks.add(key);try{return await task();}finally{locks.delete(key);} }
