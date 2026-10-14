import {readFileSync} from 'node:fs';
import {createPublicClient,createWalletClient,http,parseEther,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
const c=readFileSync('contracts/.env','utf8');const get=n=>c.match(new RegExp('^'+n+'=(.*)$','m'))?.[1]?.trim();
const account=privateKeyToAccount(get('DEPLOYER_PRIVATE_KEY'));
const to=get('RELAYER_ADDRESS');const rpc=get('MONAD_RPC');
const publicClient=createPublicClient({transport:http(rpc,{timeout:15000,retryCount:0})});
if(await publicClient.getChainId()!==10143)throw new Error('Wrong network');
const current=await publicClient.getBalance({address:to});
if(current>=parseEther('0.25')){console.log('Relayer already funded:',formatEther(current),'test MON');process.exit(0);}
const amount=parseEther('0.5');
const source=await publicClient.getBalance({address:account.address});
if(source<parseEther('0.55'))throw new Error('Deployer balance too low for the internal test transfer');
const client=createWalletClient({account,transport:http(rpc,{timeout:15000,retryCount:0})});
const hash=await client.sendTransaction({to,value:amount,gas:21000n});
const receipt=await publicClient.waitForTransactionReceipt({hash});
if(receipt.status!=='success')throw new Error('Transfer reverted');
console.log(JSON.stringify({to,amountTestMon:'0.5',transactionHash:hash,confirmed:true}));
