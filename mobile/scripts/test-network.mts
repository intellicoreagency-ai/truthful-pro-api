// Connection drops while syncing: the app's half of "no data loss, no duplicates".
// The server half (it recognises a retried command) is covered by api/test/api.test.ts ("network drop during …").
// Here a fake server stores each command, then the connection drops BEFORE the app gets the answer; the app retries on its next sync.
// The test checks the app sends the SAME keys on the retry, ends with one request, one copy of each file and one submission, and keeps
// everything local while the network is down. Runs in Node with tiny stand-ins for react-native / expo-secure-store (no device needed).
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('data:text/javascript,'+encodeURIComponent(`
const stubs={'react-native':'export const Platform={OS:"web"};','expo-secure-store':'export const getItemAsync=async()=>null,setItemAsync=async()=>{},deleteItemAsync=async()=>{},WHEN_UNLOCKED_THIS_DEVICE_ONLY=0;'};
export async function resolve(spec,ctx,next){
  if(stubs[spec])return{url:'data:text/javascript,'+encodeURIComponent(stubs[spec]),shortCircuit:true};
  if(/^\\.{1,2}\\//.test(spec)&&!/\\.[cm]?[jt]sx?$/.test(spec)){for(const ext of ['.ts','.tsx']){try{return await next(spec+ext,ctx)}catch{}}}
  return next(spec,ctx);
}`));
(globalThis as any).__DEV__=true;
process.env.EXPO_PUBLIC_API_URL='http://localhost:8788';
const {pushRequest,apiEnabled,ApiError}=await import('../src/api.ts');
assert.ok(apiEnabled,'the test talks to a (fake) local server');

// ---- fake server: idempotent like the real one; can "lose" the response of chosen calls after doing the work ----
type Req={id:string;key:string;status:string;submits:number};
const server={requests:new Map<string,Req>(),files:new Map<string,{id:string;key:string|null}>(),uploads:0,dropAfter:new Set<string>(),offline:false,seen:[] as string[]};
let n=0;const uid=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
(globalThis as any).fetch=async(url:string,init:RequestInit={})=>{
  const method=(init.method??'GET').toUpperCase(),path=String(url).replace('http://localhost:8788','').split('?')[0]!;
  const h=(init.headers??{}) as Record<string,string>;
  if(server.offline)throw new TypeError('Network request failed'); // nothing reached the server
  const tag=`${method} ${path.replace(/[0-9a-f-]{36}/g,':id')}`;server.seen.push(tag+(h['x-client-key']?` key=${h['x-client-key']}`:''));
  let res:Response;
  if(method==='POST'&&path==='/v1/requests'){
    const b=JSON.parse(String(init.body));const prev=[...server.requests.values()].find(r=>r.key===b.clientKey);
    if(prev)res=reply(200,{id:prev.id,replay:true});else{const r={id:uid(),key:b.clientKey,status:'draft',submits:0};server.requests.set(r.id,r);res=reply(201,{id:r.id})}
  }else if(method==='PUT'&&/\/files$/.test(path)){
    const key=h['x-client-key']??null;const prev=key?[...server.files.values()].find(f=>f.key===key):undefined;
    if(prev)res=reply(200,{id:prev.id,replay:true});else{const f={id:uid(),key};server.files.set(f.id,f);server.uploads++;res=reply(201,{id:f.id})}
  }else if(method==='PATCH'&&/^\/v1\/requests\//.test(path)){
    const r=server.requests.get(path.split('/')[3]!)!;const b=JSON.parse(String(init.body));
    if(b.status==='submitted'&&r.status==='draft'){r.status='submitted';r.submits++}
    res=reply(200,{ok:true,status:r.status});
  }else res=reply(200,{ok:true});
  if(server.dropAfter.delete(tag))throw new TypeError('Network request failed'); // the work is done, but the answer never arrives
  return res;
};

// ---- a request the customer finished on the phone: two documents, submitted ----
const now=new Date().toISOString();
const local:any={id:'lx1req-abc1234',serviceId:'emirates-id',actionId:'renew',title:{ar:'تجديد الهوية',en:'Renew'},createdAt:now,updatedAt:now,status:'submitted',stage:1,name:'Mona',phone:'+971529990011',fields:{},
  files:[{id:'lx1fileA-123456',name:'passport.pdf',mime:'application/pdf',size:10,kind:'source',label:{ar:'جواز',en:'Passport'},createdAt:now},{id:'lx1fileB-123456',name:'photo.jpg',mime:'image/jpeg',size:10,kind:'source',label:{ar:'صورة',en:'Photo'},createdAt:now}],
  missing:[],events:[],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false}};
const bytes=async()=>new Uint8Array([1,2,3]);
const attempt=async()=>{try{return await pushRequest(local,bytes)}catch(e){return e as Error}};

// 1) offline: nothing leaves the phone, the request stays local and unsynced
server.offline=true;
let out=await attempt();
assert.ok(out instanceof ApiError&&out.code==='network','offline is reported as a network error');
assert.equal(server.requests.size,0);assert.equal(local.remoteId,undefined,'the local record is untouched (kept for the next sync)');
server.offline=false;

// 2) the create is stored but its answer is lost
server.dropAfter.add('POST /v1/requests');
out=await attempt();assert.ok(out instanceof Error);
// 3) next sync: same request (replay); the first upload is stored but its answer is lost
server.dropAfter.add('PUT /v1/requests/:id/files');
out=await attempt();assert.ok(out instanceof Error);
// 4) next sync: both files, then the submit is stored but its answer is lost
server.dropAfter.add('PATCH /v1/requests/:id');
out=await attempt();assert.ok(out instanceof Error);
// 5) the connection is good again
const done=await attempt();
assert.ok(!(done instanceof Error),'the last sync succeeds');

assert.equal(server.requests.size,1,'one request on the server, however many retries');
const only=[...server.requests.values()][0]!;
assert.equal(only.key,'lx1req-abc1234','created with the local id as its idempotency key');
assert.equal(only.status,'submitted');assert.equal(only.submits,1,'submitted exactly once');
assert.equal(server.uploads,2,'each document stored once');
const keys=server.seen.filter(s=>s.includes('key=')).map(s=>s.split('key=')[1]);
assert.ok(keys.every(k=>k==='lx1fileA-123456'||k==='lx1fileB-123456'),'every upload carries the local file id as its key');
assert.ok(keys.filter(k=>k==='lx1fileA-123456').length>=2,'the retried upload reused the same key');
const synced=done as any;
assert.equal(synced.remoteId,only.id);assert.equal(synced.files.length,2);assert.ok(synced.files.every((f:any)=>f.remoteId),'both local files are linked to their server copies');
assert.equal(new Set(synced.files.map((f:any)=>f.remoteId)).size,2);
console.log('PASS: connection drops during create, upload and submit: retries send the same keys; one request, one copy of each file, one submission; nothing lost offline.');
