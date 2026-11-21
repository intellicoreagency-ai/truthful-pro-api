import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {ClientFile,ClientRequest} from './clientModel';
import {holdsUpload,missingIdFor,toClientRequest,type ServerDetail,type ServerRow} from './syncMap';

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
/** Resolves 'pending' | 'expired' | 'verified' (+ whether the number had no account yet). On 'verified' the session tokens are stored in the device keychain/keystore (expo-secure-store). */
export async function waPoll(phone:string,c:Pick<WaChallenge,'challengeId'|'pollToken'>):Promise<{status:'pending'|'expired'|'verified';isNewUser?:boolean}>{
  const j=await json<{status:'pending'|'expired'|'verified';isNewUser?:boolean;accessToken?:string;refreshToken?:string}>(await call('POST','/v1/auth/wa/poll',{auth:false,body:{phone,challengeId:c.challengeId,pollToken:c.pollToken}}));
  if(j.status==='verified'&&j.accessToken&&j.refreshToken)await saveTokens(j.accessToken,j.refreshToken);
  return {status:j.status,isNewUser:j.isNewUser};
}
/** Display name for the account (the server stores it with the profile). */
export async function setServerName(displayName:string){await call('PATCH','/v1/me',{body:{displayName}})}
export async function logout(){try{if(mem.access)await call('POST','/v1/auth/logout')}catch{}await clearTokens()}
export const me=async()=>json<{user:{id:string;display_name:string|null;language:'ar'|'en';email_set?:boolean;email_verified?:boolean}}>(await call('GET','/v1/me'));
export const recordConsent=(type:'terms'|'privacy'|'document_processing',version:string,accepted:boolean)=>call('POST','/v1/consents',{body:{type,version,accepted}});
export const exportMyData=async()=>json<unknown>(await call('GET','/v1/me/export'));
/** Saves the email on the server: a welcome email with a confirmation link is sent; invoices are emailed only after it is confirmed. */
export async function setServerEmail(email:string){await call('PATCH','/v1/me',{body:{email}})}
export async function deleteAccount(){await call('DELETE','/v1/me',{body:{confirm:'DELETE'}});await clearTokens()}

// ---- requests ----
type Row=ServerRow;

/** Only user-entered content is sent. Status, pricing and staff notes are never taken from the device. */
function toServerData(r:ClientRequest){return{actionId:r.actionId,title:r.title,name:r.name,phone:r.phone,fields:r.fields,termsVersion:r.termsVersion,termsAcceptedAt:r.termsAcceptedAt,createdAt:r.createdAt,renewalOf:r.renewalOf,fileLabels:Object.fromEntries(r.files.filter(f=>f.remoteId&&f.kind==='source').map(f=>[f.remoteId,{label:f.label,kind:f.kind,name:f.name}]))}}

/** Uploads a local file's bytes; returns the server file id. */
async function upload(requestRemoteId:string,f:ClientFile,bytes:Blob|Uint8Array,missingId?:string){
  // x-client-key = the local file id: if the connection drops after the server stored the file, the retry gets the same file back (no duplicate)
  const r=await call('PUT',`/v1/requests/${requestRemoteId}/files${missingId?`?missingId=${missingId}`:''}`,{raw:bytes,headers:{'x-file-name':encodeURIComponent(f.name),'content-type':f.mime,'x-client-key':f.id}});
  return (await json<{id:string}>(r)).id;
}

/** Creates or updates one request on the server. `getBytes` reads a local attachment. Returns the updated record. */
export async function pushRequest(r:ClientRequest,getBytes:(f:ClientFile)=>Promise<Blob|Uint8Array>,remoteIdOf:(localId:string)=>string|undefined=()=>undefined):Promise<ClientRequest>{
  if(r.sample)return r;
  let remoteId=r.remoteId;
  if(!remoteId){
    const c=await json<{id:string}>(await call('POST','/v1/requests',{body:{serviceId:r.serviceId,data:toServerData(r),renewalOf:r.renewalOf?remoteIdOf(r.renewalOf):undefined,clientKey:r.id}}));
    remoteId=c.id;
  }
  const files:ClientFile[]=[];
  for(const f of r.files){
    if(f.remoteId||f.kind!=='source'||holdsUpload(r,f)){files.push(f);continue}
    files.push({...f,remoteId:await upload(remoteId,f,await getBytes(f),missingIdFor(r,f.id))});
  }
  const next={...r,remoteId,files};
  const patch:Record<string,unknown>={data:toServerData(next)};
  if(r.status==='submitted'||r.status==='cancelled')patch.status=r.status; // clients may only submit or cancel
  await call('PATCH',`/v1/requests/${remoteId}`,{body:patch});
  // The customer confirmed receipt on this device: record it for the delivery they saw (idempotent; a stale version is ignored).
  if(r.acknowledgedAt&&r.deliveryVersion){try{await call('POST',`/v1/requests/${remoteId}/acknowledgments`,{body:{deliveryVersion:r.deliveryVersion}})}catch(e){if(!(e instanceof ApiError&&e.status===409))throw e}}
  return{...next,syncedAt:new Date().toISOString()};
}

/** Creates the request on the server and RETURNS only when the server has stored it (the reference is the server's). Idempotent: the same local id (clientKey) never creates a second request. */
export async function createRemoteRequest(r:ClientRequest):Promise<{id:string}>{
  return json<{id:string}>(await call('POST','/v1/requests',{body:{serviceId:r.serviceId,data:toServerData(r),renewalOf:undefined,clientKey:r.id}}));
}
/** Moves a draft to "submitted" (the server refuses it without an email on the account). */
export async function submitRemoteRequest(remoteId:string){await call('PATCH',`/v1/requests/${remoteId}`,{body:{status:'submitted'}})}

export const needsSync=(r:ClientRequest)=>!r.sample&&(!r.syncedAt||r.updatedAt>r.syncedAt);

/** Server is authoritative for status/stage. Local-only records (unsynced drafts) are kept. */
export async function pullRequests(local:ClientRequest[]):Promise<ClientRequest[]>{
  const {requests}=await json<{requests:Row[]}>(await call('GET','/v1/requests'));
  const byRemote=new Map(local.filter(r=>r.remoteId).map(r=>[r.remoteId!,r]));
  const merged:ClientRequest[]=[];
  for(const row of requests){
    const det=await json<ServerDetail>(await call('GET',`/v1/requests/${row.id}`));
    merged.push(toClientRequest(row,det,byRemote.get(row.id)));
  }
  // keep records the server doesn't know yet, and samples
  for(const r of local)if(!r.remoteId||r.sample)merged.push(r);
  return merged;
}

/** Fresh server copy of one request. The server only returns requests owned by the signed-in user (404 otherwise); the id alone never grants access. */
export async function fetchRequest(remoteId:string,local?:ClientRequest):Promise<ClientRequest>{
  const det=await json<ServerDetail&{request:Row}>(await call('GET',`/v1/requests/${encodeURIComponent(remoteId)}`));
  return toClientRequest(det.request,det,local);
}

export async function downloadRemote(remoteFileId:string):Promise<Blob>{return await (await call('GET',`/v1/files/${remoteFileId}`)).blob()}
export async function deleteRemoteRequest(remoteId:string){await call('DELETE',`/v1/requests/${remoteId}`)}
export async function deleteRemoteFile(remoteFileId:string){await call('DELETE',`/v1/files/${remoteFileId}`)}

// ---- money (test copies; manual payments) ----
/** Uploads the transfer proof, then reports the payment. The same clientKey makes a retry safe; it stays pending until the team verifies it. */
export async function submitPayment(remoteRequestId:string,proof:ClientFile,bytes:Blob|Uint8Array,p:{amountFils:number;reference:string;clientKey:string}){
  const proofFileId=await upload(remoteRequestId,proof,bytes);
  return json<{id:string;status:string}>(await call('POST',`/v1/requests/${remoteRequestId}/payments`,{body:{amountFils:p.amountFils,method:'bank_transfer',reference:p.reference,proofFileId,clientKey:p.clientKey}}));
}
/** The customer paid the government fee to the authority themselves (official link); this only reports it for verification. */
export async function reportAuthorityPayment(remoteRequestId:string,proof:ClientFile|null,bytes:Blob|Uint8Array|null,p:{amountFils:number;reference:string;clientKey:string}){
  const proofFileId=proof&&bytes?await upload(remoteRequestId,proof,bytes):undefined;
  return json<{id:string;status:string}>(await call('POST',`/v1/requests/${remoteRequestId}/authority-payments`,{body:{amountFils:p.amountFils,reference:p.reference,proofFileId,clientKey:p.clientKey}}));
}
/** The customer approves the exact quotation version they were shown; the server then issues the invoice. Safe to retry (a replay returns the same invoice). */
export async function acceptQuote(remoteRequestId:string,quoteId:string,version:number){
  return json<{ok:boolean;invoiceId:string;number:string|null;replay:boolean}>(await call('POST',`/v1/requests/${remoteRequestId}/quotes/${quoteId}/accept`,{body:{version}}));
}
/** The customer declines the quotation (optional reason). The team can send a new version. Safe to retry. */
export async function declineQuote(remoteRequestId:string,quoteId:string,reason:string){
  return json<{ok:boolean;replay:boolean}>(await call('POST',`/v1/requests/${remoteRequestId}/quotes/${quoteId}/decline`,{body:{reason}}));
}
/** Opens a tracked delivery-problem case for the team (the server keeps it; nothing about the request is deleted). */
export async function reportDeliveryProblem(remoteRequestId:string,text:string){await call('POST',`/v1/requests/${remoteRequestId}/problems`,{body:{text}})}
export async function fetchDocumentHtml(docId:string):Promise<string>{return await (await call('GET',`/v1/documents/${docId}`)).text()}
