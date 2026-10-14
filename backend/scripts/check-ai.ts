import 'dotenv/config';
import {streamQwen} from '../src/qwen.js';
try {
 const result=await streamQwen([{role:'user',content:'Reply with exactly: FairAI is ready.'}],()=>{},AbortSignal.timeout(30000));
 console.log(JSON.stringify({ok:true,model:process.env.LLM_MODEL||process.env.QWEN_MODEL,inputUsage:result.input,outputUsage:result.output,response:result.text}));
} catch (error) {
 const message=error instanceof Error?error.message:'';
 if(/^AI provider returned HTTP \d+\.$/.test(message))console.error(message);
 if(message==='AI provider returned HTTP 404.'&&process.env.LLM_BASE_URL&&process.env.LLM_API_KEY){
  try{
   const response=await fetch(`${process.env.LLM_BASE_URL.replace(/\/$/,'')}/models`,{headers:{Authorization:`Bearer ${process.env.LLM_API_KEY}`},signal:AbortSignal.timeout(10000)});
   console.error('Model list HTTP status:',response.status);
   if(response.ok){const data=await response.json() as {data?:{id:string}[]};const ids=(data.data??[]).map(m=>m.id).filter(id=>/^[a-zA-Z0-9/._:-]+$/.test(id));console.error('Configured model available:',ids.includes(process.env.LLM_MODEL||''));console.error('Available text model candidates:',ids.filter(id=>/llama|qwen|gpt-oss/.test(id)).join(', '));}
  }catch{console.error('Could not check model availability.');}
 }
 console.error('AI check failed. Check provider settings, key validity, network access and available quota. No credentials were logged.');
 process.exitCode=1;
}
