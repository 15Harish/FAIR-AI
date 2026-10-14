import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streamQwen} from './qwen.js';
test('generic compatible provider settings take priority over legacy Qwen settings',async(t)=>{
 const names=['LLM_API_KEY','LLM_BASE_URL','LLM_MODEL','QWEN_API_KEY'];
 const prior=names.map(n=>process.env[n]);
 t.after(()=>names.forEach((n,i)=>{if(prior[i]===undefined)delete process.env[n];else process.env[n]=prior[i];}));
 process.env.LLM_API_KEY='test-generic';process.env.LLM_BASE_URL='https://api.groq.com/openai/v1';process.env.LLM_MODEL='llama-3.3-70b-versatile';process.env.QWEN_API_KEY='test-legacy';
 t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal((options.headers as Record<string,string>).Authorization,'Bearer test-generic');
  assert.equal(JSON.parse(options.body as string).model,'llama-3.3-70b-versatile');
  return new Response('data: {"choices":[{"delta":{"content":"Ready"}}],"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\ndata: [DONE]\n');
 });
 assert.deepEqual(await streamQwen([],()=>{}),{text:'Ready',input:2,output:1});
});
test('handles fragmented SSE and final usage, and limits output',async(t)=>{
 const prior=process.env.QWEN_API_KEY;process.env.QWEN_API_KEY='test-only';t.after(()=>{if(prior===undefined)delete process.env.QWEN_API_KEY;else process.env.QWEN_API_KEY=prior;});
 const wire='data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}\n\ndata: [DONE]\n';
 t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{const body=JSON.parse(options.body as string);assert.equal(body.max_tokens,1024);assert.equal(body.stream_options.include_usage,true);const encoder=new TextEncoder();return new Response(new ReadableStream({start(controller){for(const chunk of [wire.slice(0,19),wire.slice(19,67),wire.slice(67)])controller.enqueue(encoder.encode(chunk));controller.close();}}));});
 const chunks:string[]=[];const result=await streamQwen([{role:'user',content:'Hi'}],text=>chunks.push(text));assert.deepEqual(result,{text:'Hello',input:7,output:2});assert.deepEqual(chunks,['Hello']);
});
test('a stream without provider usage cannot be billed',async(t)=>{
 const prior=process.env.QWEN_API_KEY;process.env.QWEN_API_KEY='test-only';t.after(()=>{if(prior===undefined)delete process.env.QWEN_API_KEY;else process.env.QWEN_API_KEY=prior;});
 t.mock.method(globalThis,'fetch',async()=>new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: [DONE]\n'));
 await assert.rejects(()=>streamQwen([],()=>{}),/not been billed/);
});
