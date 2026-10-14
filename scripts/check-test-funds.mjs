import {readFileSync} from 'node:fs';
import {createPublicClient,http,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
const c=readFileSync('contracts/.env','utf8'),b=readFileSync('backend/.env','utf8');
const get=(s,n)=>s.match(new RegExp('^'+n+'=(.*)$','m'))?.[1]?.trim();
const client=createPublicClient({transport:http(get(c,'MONAD_RPC'),{timeout:15000,retryCount:0})});
try{
 const id=await client.getChainId();if(id!==10143)throw new Error('Wrong network');
 const funded=get(b,'FUNDED_ACCOUNT_ADDRESS');
 const accounts=[['deployer',privateKeyToAccount(get(c,'DEPLOYER_PRIVATE_KEY')).address],['relayer',privateKeyToAccount(get(b,'RELAYER_PRIVATE_KEY')).address]];
 if(funded&&/^0x[0-9a-f]{40}$/i.test(funded))accounts.push(['existing funded account',funded]);
 for(const [role,address]of accounts)console.log(JSON.stringify({role,address,testnetMon:formatEther(await client.getBalance({address}))}));
}catch{console.error('Could not verify Monad Testnet balances. No credentials logged.');process.exitCode=1;}
