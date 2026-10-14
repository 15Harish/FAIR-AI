import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {privateKeyToAccount} from 'viem/accounts';
const env={...process.env};
for(const line of readFileSync('contracts/.env','utf8').split(/\r?\n/)){
 const match=line.match(/^([A-Z_0-9]+)=(.*)$/);if(match)env[match[1]]=match[2].trim();
}
if(!/^0x[0-9a-fA-F]{64}$/.test(env.DEPLOYER_PRIVATE_KEY||''))throw new Error('DEPLOYER_PRIVATE_KEY missing or invalid');
if(!/^0x[0-9a-fA-F]{40}$/.test(env.RELAYER_ADDRESS||''))throw new Error('RELAYER_ADDRESS missing or invalid');
if(!/^https:\/\//.test(env.MONAD_RPC||''))throw new Error('MONAD_RPC missing or invalid');
console.log('Deploying from:',privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY).address);
console.log('Authorized service:',env.RELAYER_ADDRESS);
const forge=resolve('node_modules/@foundry-rs/forge-'+process.platform+'-'+(process.arch==='x64'?'amd64':process.arch)+'/bin/forge'+(process.platform==='win32'?'.exe':''));
const args=['script','script/Deploy.s.sol:Deploy','--rpc-url',env.MONAD_RPC,'--gas-estimate-multiplier','100'];
if(!process.argv.includes('--dry-run'))args.push('--broadcast','--slow');
const result=spawnSync(forge,args,{cwd:resolve('contracts'),env,stdio:'inherit'});
if(result.error)console.error(result.error.message);
process.exit(result.status??1);
