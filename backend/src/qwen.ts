export interface ChatMessage {role:string;content:string}
export async function streamQwen(messages:ChatMessage[],delta:(text:string)=>void,signal?:AbortSignal){
 const generic=!!process.env.LLM_API_KEY?.trim();
 const apiKey=generic?process.env.LLM_API_KEY:process.env.QWEN_API_KEY;
 const baseUrl=generic?process.env.LLM_BASE_URL:process.env.QWEN_BASE_URL||'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
 const model=generic?process.env.LLM_MODEL:process.env.QWEN_MODEL||'qwen-plus';
 if(!apiKey||!baseUrl||!model)throw new Error('AI service is not configured');
 const response=await fetch(`${baseUrl.replace(/\/$/,'')}/chat/completions`,{method:'POST',signal:signal??AbortSignal.timeout(90000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'You are FairAI, a helpful, accurate assistant for students and freelancers. Be concise and clear.'},...messages],stream:true,stream_options:{include_usage:true},max_tokens:1024})});
 if(!response.ok)throw new Error(`AI provider returned HTTP ${response.status}.`);
 if(!response.body)throw new Error('AI provider returned no stream.');
 let text='',input:number|undefined,output:number|undefined,buffer='';
 const consume=(line:string)=>{if(!line.startsWith('data:'))return;const data=line.slice(5).trim();if(!data||data==='[DONE]')return;const item=JSON.parse(data);if(item.error)throw new Error('AI response failed');const chunk=item.choices?.[0]?.delta?.content;if(typeof chunk==='string'){text+=chunk;delta(chunk);}if(item.usage){input=item.usage.prompt_tokens;output=item.usage.completion_tokens;}};
 const reader=response.body.getReader(),decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end:number;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}}
 if(buffer.trim())consume(buffer.trim());
 if(input===undefined||output===undefined)throw new Error('AI usage was not returned. This answer has not been billed.');
 return {text,input,output};
}
