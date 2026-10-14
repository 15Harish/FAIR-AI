const fs=require('fs'),path=require('path'),solc=require('solc');
const sources={};
for(const name of ['MockINR','FairAI'])sources[`src/${name}.sol`]={content:fs.readFileSync(`contracts/src/${name}.sol`,'utf8')};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode']}}}}),{import:p=>{try{return {contents:fs.readFileSync(path.join('node_modules',p),'utf8')}}catch(e){return {error:e.message}}}}));
for(const e of output.errors??[]){console.error(e.formattedMessage);if(e.severity==='error')process.exitCode=1;}
if(process.exitCode)process.exit(1);
const previous=fs.existsSync('shared/deployments.json')?JSON.parse(fs.readFileSync('shared/deployments.json','utf8')):null;
const deployment={chainId:10143};
for(const name of ['MockINR','FairAI']){
 const artifact=output.contracts[`src/${name}.sol`][name];
 fs.mkdirSync(`contracts/out/${name}.sol`,{recursive:true});fs.writeFileSync(`contracts/out/${name}.sol/${name}.json`,JSON.stringify(artifact,null,2));
 deployment[name]={address:previous?.[name]?.address??'0x0000000000000000000000000000000000000000',abi:artifact.abi};
 if(name==='FairAI')deployment[name].deployBlock=previous?.FairAI?.deployBlock??0;
}
fs.mkdirSync('shared',{recursive:true});fs.writeFileSync('shared/deployments.json',JSON.stringify(deployment,null,2)+'\n');
console.log('Contracts compiled; shared ABIs updated (no deployment performed).');
