import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {ClientFile,ClientRequest,Status} from './clientModel';

/** Set EXPO_PUBLIC_API_URL at build time (see eas.json). Empty = offline preview, no network calls. */
const RAW=(process.env.EXPO_PUBLIC_API_URL??'').replace(/\/+$/,'');
export const API_URL=RAW;
export const apiEnabled=/^https:\/\//.test(RAW)||(__DEV__&&/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(RAW));

export class ApiError extends Error{constructor(public status:number,public code:string){super(code)}}

// Tokens live in the OS keychain/keystore on devices. On web they stay in memory only (never localStorage).
let mem:{access?:string;refresh?:string}={};
const KA='tp.access',KR='tp.refresh';
const native=Platform.OS!=='web';
export async function loadTokens(){if(native){try{mem={access:await SecureStore.getItemAsync(KA)??undefined,refresh:await SecureStore.getItemAsync(KR)??undefined}}catch{mem={}}}return !!mem.refresh}
async function saveTokens(a:string,r:string){mem={access:a,refresh:r};if(native){await SecureStore.setItemAsync(KA,a,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});await SecureStore.setItemAsync(KR,r,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY})}}
export async function clearTokens(){mem={};if(native){try{await SecureStore.deleteItemAsync(KA);await SecureStore.deleteItemAsync(KR)}catch{}}}
export const hasSession=()=>!!mem.refresh;

let onExpired:()=>void=()=>{};
export const setSessionExpiredHandler=(f:()=>void)=>{onExpired=f};

let refreshing:Promise<boolean>|null=null;
function refresh():Promise<boolean>{
  if(!mem.refresh)return Promise.resolve(false);
  refreshing??=(async()=>{
    try{
      const r=await fetch(API_URL+'/v1/auth/refresh',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refreshToken:mem.refresh})});
      if(!r.ok){await clearTokens();return false}
      const j=await r.json();await saveTokens(j.accessToken,j.refreshToken);return true;
    }catch{return false} // network failure: keep the session, try later
    finally{refreshing=null}
  })();
  return refreshing;
}

async function call(method:string,path:string,opts:{body?:unknown;raw?:Uint8Array|Blob;headers?:Record<string,string>;auth?:boolean}={}):Promise<Response>{
  if(!apiEnabled)throw new ApiError(0,'offline');
  const go=()=>{
    const headers:Record<string,string>={...(opts.headers??{})};
    let body:BodyInit|undefined;
    if(opts.raw)body=opts.raw as BodyInit;else if(opts.body!==undefined){headers['content-type']='application/json';body=JSON.stringify(opts.body)}
    if(opts.auth!==false&&mem.access)headers.authorization='Bearer '+mem.access;
    return fetch(API_URL+path,{method,headers,body});
  };
  let r:Response;
  try{r=await go()}catch{throw new ApiError(0,'network')}
  if(r.status===401&&opts.auth!==false&&mem.refresh){
    if(await refresh()){try{r=await go()}catch{throw new ApiError(0,'network')}}
    if(r.status===401){await clearTokens();onExpired()}
  }
  if(!r.ok){let code='error';try{code=(await r.json()).error??code}catch{}throw new ApiError(r.status,code)}
  return r;
}
const json=async<T>(r:Response)=>await r.json() as T;

// ---- auth ----
export async function requestOtp(phone:string,language:'ar'|'en'){return json<{challengeId:string;expiresIn:number}>(await call('POST','/v1/auth/otp/request',{auth:false,body:{phone,language}}))}
export async function verifyOtp(phone:string,challengeId:string,code:string){
  const j=await json<{accessToken:string;refreshToken:string;isNewUser:boolean}>(await call('POST','/v1/auth/otp/verify',{auth:false,body:{phone,challengeId,code}}));
  await saveTokens(j.accessToken,j.refreshToken);return j.isNewUser;
}
export type WaChallenge={challengeId:string;pollToken:string;code:string;expiresIn:number;link:string};
export const waStart=async(phone:string,language:'ar'|'en')=>json<WaChallenge>(await call('POST','/v1/auth/wa/start',{auth:false,body:{phone,language}}));
/** Resolves 'pending' | 'expired' | 'verified'. On 'verified' the session tokens are stored. */
export async function waPoll(phone:string,c:Pick<WaChallenge,'challengeId'|'pollToken'>):Promise<'pending'|'expired'|'verified'>{
  const j=await json<{status:'pending'|'expired'|'verified';accessToken?:string;refreshToken?:string}>(await call('POST','/v1/auth/wa/poll',{auth:false,body:{phone,challengeId:c.challengeId,pollToken:c.pollToken}}));
  if(j.status==='verified'&&j.accessToken&&j.refreshToken)await saveTokens(j.accessToken,j.refreshToken);
  return j.status;
}
export async function logout(){try{if(mem.access)await call('POST','/v1/auth/logout')}catch{}await clearTokens()}
export const me=async()=>json<{user:{id:string;display_name:string|null;language:'ar'|'en'}}>(await call('GET','/v1/me'));
export const recordConsent=(type:'terms'|'privacy'|'document_processing',version:string,accepted:boolean)=>call('POST','/v1/consents',{body:{type,version,accepted}});
export const exportMyData=async()=>json<unknown>(await call('GET','/v1/me/export'));
export async function deleteAccount(){await call('DELETE','/v1/me',{body:{confirm:'DELETE'}});await clearTokens()}

// ---- requests ----
type Row={id:string;service_id:string;status:Status;data:string;renewal_of:string|null;created_at:number;updated_at:number};
const STAGE:Record<Status,1|2|3|4|5>={draft:1,submitted:1,review:2,needs_documents:2,authority:3,decision:4,completed:5,cancelled:1,rejected:5};
const iso=(ms:number)=>new Date(ms).toISOString();

/** Only user-entered content is sent. Status, pricing and staff notes are never taken from the device. */
function toServerData(r:ClientRequest){return{actionId:r.actionId,title:r.title,name:r.name,phone:r.phone,fields:r.fields,termsVersion:r.termsVersion,termsAcceptedAt:r.termsAcceptedAt,createdAt:r.createdAt,renewalOf:r.renewalOf,fileLabels:Object.fromEntries(r.files.filter(f=>f.remoteId).map(f=>[f.remoteId,{label:f.label,kind:f.kind,name:f.name}]))}}

function fromRow(row:Row,files:{id:string;name:string;mime:string;size:number;created_at:number}[],local?:ClientRequest):ClientRequest{
  let d:any={};try{d=JSON.parse(row.data)}catch{}
  const labels=d.fileLabels??{};
  const base:ClientRequest=local??{id:row.id,serviceId:row.service_id,actionId:d.actionId??'',title:d.title??{ar:'طلب',en:'Request'},createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),status:row.status,stage:STAGE[row.status],name:d.name??'',phone:d.phone??'',fields:d.fields??{},files:[],missing:[],events:[],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false},termsVersion:d.termsVersion,termsAcceptedAt:d.termsAcceptedAt,renewalOf:d.renewalOf};
  const known=new Set(base.files.map(f=>f.remoteId));
  const extra:ClientFile[]=files.filter(f=>!known.has(f.id)).map(f=>({id:f.id,remoteId:f.id,name:f.name,mime:f.mime,size:f.size,kind:labels[f.id]?.kind??'source',label:labels[f.id]?.label??{ar:f.name,en:f.name},createdAt:iso(f.created_at)}));
  return{...base,remoteId:row.id,status:row.status,stage:STAGE[row.status],updatedAt:iso(row.updated_at),files:[...base.files,...extra],syncedAt:iso(row.updated_at)};
}

/** Uploads a local file's bytes; returns the server file id. */
async function upload(requestRemoteId:string,f:ClientFile,bytes:Blob|Uint8Array){
  const r=await call('PUT',`/v1/requests/${requestRemoteId}/files`,{raw:bytes,headers:{'x-file-name':encodeURIComponent(f.name),'content-type':f.mime}});
  return (await json<{id:string}>(r)).id;
}

/** Creates or updates one request on the server. `getBytes` reads a local attachment. Returns the updated record. */
export async function pushRequest(r:ClientRequest,getBytes:(f:ClientFile)=>Promise<Blob|Uint8Array>,remoteIdOf:(localId:string)=>string|undefined=()=>undefined):Promise<ClientRequest>{
  if(r.sample)return r;
  let remoteId=r.remoteId;
  if(!remoteId){
    const c=await json<{id:string}>(await call('POST','/v1/requests',{body:{serviceId:r.serviceId,data:toServerData(r),renewalOf:r.renewalOf?remoteIdOf(r.renewalOf):undefined}}));
    remoteId=c.id;
  }
  const files:ClientFile[]=[];
  for(const f of r.files){
    if(f.remoteId||f.kind!=='source'){files.push(f);continue}
    files.push({...f,remoteId:await upload(remoteId,f,await getBytes(f))});
  }
  const next={...r,remoteId,files};
  const patch:Record<string,unknown>={data:toServerData(next)};
  if(r.status==='submitted'||r.status==='cancelled')patch.status=r.status; // clients may only submit or cancel
  await call('PATCH',`/v1/requests/${remoteId}`,{body:patch});
  return{...next,syncedAt:new Date().toISOString()};
}

export const needsSync=(r:ClientRequest)=>!r.sample&&(!r.syncedAt||r.updatedAt>r.syncedAt);

/** Server is authoritative for status/stage. Local-only records (unsynced drafts) are kept. */
export async function pullRequests(local:ClientRequest[]):Promise<ClientRequest[]>{
  const {requests}=await json<{requests:Row[]}>(await call('GET','/v1/requests'));
  const byRemote=new Map(local.filter(r=>r.remoteId).map(r=>[r.remoteId!,r]));
  const merged:ClientRequest[]=[];const seen=new Set<string>();
  for(const row of requests){
    const det=await json<{files:{id:string;name:string;mime:string;size:number;created_at:number}[]}>(await call('GET',`/v1/requests/${row.id}`));
    const l=byRemote.get(row.id);
    merged.push(fromRow(row,det.files,l&&l.syncedAt&&l.updatedAt>l.syncedAt?undefined:l));
    seen.add(row.id);
  }
  // keep records the server doesn't know yet, and samples
  for(const r of local)if(!r.remoteId||r.sample)merged.push(r);
  return merged;
}

export async function downloadRemote(remoteFileId:string):Promise<Blob>{return await (await call('GET',`/v1/files/${remoteFileId}`)).blob()}
export async function deleteRemoteRequest(remoteId:string){await call('DELETE',`/v1/requests/${remoteId}`)}
export async function deleteRemoteFile(remoteFileId:string){await call('DELETE',`/v1/files/${remoteFileId}`)}
