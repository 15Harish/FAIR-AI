import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {isAddress,getAddress} from 'viem';
const broadcastPath=process.argv[2];
let mock='0x0000000000000000000000000000000000000000',fair=mock,block=0;
if(broadcastPath){
 const b=JSON.parse(readFileSync(broadcastPath,'utf8'));
 const created=(b.transactions??[]).filter((t:any)=>t.transactionType==='CREATE');
 if(created.length!==2)throw new Error(`Expected two created contracts; found ${created.length}`);
 mock=created[0].contractAddress;fair=created[1].contractAddress;
 const creation=created[1];
 const receipt=b.receipts?.find((r:any)=>r.transactionHash===creation?.hash);
 if(!receipt)throw new Error('Deployment receipt missing');
 block=Number(BigInt(receipt.blockNumber));
 if(!isAddress(mock)||!isAddress(fair)||fair.endsWith('0000000000000000000000000000000000000000'))throw new Error('Invalid deployment');
}
const abi=(name:string)=>JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`,'utf8')).abi;
mkdirSync('shared',{recursive:true});
const output=JSON.stringify({chainId:10143,MockINR:{address:getAddress(mock),abi:abi('MockINR')},FairAI:{address:getAddress(fair),abi:abi('FairAI'),deployBlock:block}},null,2)+'\n';
writeFileSync('shared/deployments.json',output);
mkdirSync('frontend/lib',{recursive:true});
writeFileSync('frontend/lib/deployments.json',output);
console.log(broadcastPath?'Deployment exported':'ABI exported with undeployed zero identifiers');
