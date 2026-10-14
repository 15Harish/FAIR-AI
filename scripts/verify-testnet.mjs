import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {encodeAbiParameters} from 'viem';
const d=JSON.parse(readFileSync('shared/deployments.json','utf8'));
const c=readFileSync('contracts/.env','utf8');
const get=n=>c.match(new RegExp('^'+n+'=(.*)$','m'))?.[1]?.trim();
const service=get('RELAYER_ADDRESS');
if(d.chainId!==10143||d.MockINR.address.endsWith('0000000000000000000000000000000000000000'))throw new Error('Deployment not exported');
const forge=resolve('node_modules/@foundry-rs/forge-'+process.platform+'-'+(process.arch==='x64'?'amd64':process.arch)+'/bin/forge'+(process.platform==='win32'?'.exe':''));
const specs=[
 ['MockINR',d.MockINR.address,'src/MockINR.sol:MockINR',encodeAbiParameters([{type:'address'}],[service])],
 ['FairAI',d.FairAI.address,'src/FairAI.sol:FairAI',encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint256'}],[d.MockINR.address,service,120n])]
];
for(const [name,address,contract,args]of specs){
 console.log('Verifying',name,address);
 const result=spawnSync(forge,['verify-contract',address,contract,'--chain','10143','--verifier','sourcify','--verifier-url','https://sourcify-api-monad.blockvision.org','--constructor-args',args],{cwd:resolve('contracts'),stdio:'inherit'});
 if(result.error)console.error(result.error.message);
 if(result.status!==0){process.exitCode=1;break;}
}
