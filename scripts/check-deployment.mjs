import {readFileSync} from 'node:fs';
import {createPublicClient,http,zeroAddress} from 'viem';
const d=JSON.parse(readFileSync('shared/deployments.json','utf8'));
const env=readFileSync('contracts/.env','utf8');const get=n=>env.match(new RegExp('^'+n+'=(.*)$','m'))?.[1]?.trim();
const client=createPublicClient({transport:http(get('MONAD_RPC'),{timeout:15000,retryCount:0})});
const chainId=await client.getChainId();if(chainId!==10143)throw new Error('Wrong chain');
const [inrCode,fairCode,minter,relayer,wait,cap]=await Promise.all([
 client.getCode({address:d.MockINR.address}),client.getCode({address:d.FairAI.address}),
 client.readContract({address:d.MockINR.address,abi:d.MockINR.abi,functionName:'minter'}),
 client.readContract({address:d.FairAI.address,abi:d.FairAI.abi,functionName:'relayer'}),
 client.readContract({address:d.FairAI.address,abi:d.FairAI.abi,functionName:'withdrawWait'}),
 client.readContract({address:d.FairAI.address,abi:d.FairAI.abi,functionName:'CAP'})]);
if(!inrCode||inrCode==='0x'||!fairCode||fairCode==='0x')throw new Error('Missing contract code');
if(minter.toLowerCase()!==get('RELAYER_ADDRESS').toLowerCase()||relayer.toLowerCase()!==get('RELAYER_ADDRESS').toLowerCase()||wait!==120n||cap!==1950n*10n**18n)throw new Error('Deployment settings mismatch');
console.log(JSON.stringify({chainId,MockINR:d.MockINR.address,FairAI:d.FairAI.address,deployBlock:d.FairAI.deployBlock,service:relayer,withdrawWaitSeconds:Number(wait),capRupees:'1950',codePresent:true},null,2));
