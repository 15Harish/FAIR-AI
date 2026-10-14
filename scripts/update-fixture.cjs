const fs=require('fs');
const {hashTypedData}=require('viem');
const hash=hashTypedData({domain:{name:'FairAI',version:'1',chainId:10143,verifyingContract:'0x1111111111111111111111111111111111111111'},types:{Receipt:[{name:'user',type:'address'},{name:'sessionId',type:'bytes32'},{name:'amount',type:'uint256'}]},primaryType:'Receipt',message:{user:'0x2222222222222222222222222222222222222222',sessionId:'0x'+'0'.repeat(63)+'1',amount:1230000000000000000n}});
fs.writeFileSync('contracts/test/FairAI.t.sol',fs.readFileSync('contracts/test/FairAI.t.sol','utf8').replace(/FIXTURE_HASH=(?:bytes32\(0\)|0x[0-9a-f]+)/,'FIXTURE_HASH='+hash));
console.log(hash);
