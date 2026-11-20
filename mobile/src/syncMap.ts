// Pure mapping between what the server stores and what the app shows. No React Native imports, so it can be tested in Node.
import type {ClientFile,ClientRequest,MissingDocument,Status} from './clientModel';

export type ServerRow={id:string;service_id:string;status:Status;data:string;staff_data?:string;renewal_of:string|null;created_at:number;updated_at:number};
export type ServerFile={id:string;name:string;mime:string;size:number;kind?:'source'|'final'|'invoice';label?:string|null;created_at:number};
export type ServerEvent={id:string;text_ar:string;text_en:string;created_at:number};
export type ServerMissing={id:string;label_ar:string;label_en:string;note_ar:string;note_en:string;replacement_file_id:string|null;resolved_at:number|null};
export type ServerDetail={files:ServerFile[];events?:ServerEvent[];missing?:ServerMissing[]};

export const STAGE:Record<Status,1|2|3|4|5>={draft:1,submitted:1,review:2,needs_documents:2,authority:3,decision:4,completed:5,cancelled:1,rejected:5};
const iso=(ms:number)=>new Date(ms).toISOString();
const parse=(s?:string):any=>{try{return s?JSON.parse(s):{}}catch{return {}}};
export const isServerId=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** The server id of the missing-document request a local file answers, if any. */
export function missingIdFor(r:ClientRequest,localFileId:string):string|undefined{
  const m=r.missing.find(x=>x.replacement===localFileId);
  return m&&isServerId(m.id)?m.id:undefined;
}

/** Files that answer a team request are held back until the customer presses Send (which moves the request out of needs_documents). */
export function holdsUpload(r:ClientRequest,f:ClientFile):boolean{return r.status==='needs_documents'&&!!missingIdFor(r,f.id)}

/** Server is authoritative for status, timeline, requested documents, delivery files and dates. Local-only work (unsynced files) is kept. */
export function toClientRequest(row:ServerRow,det:ServerDetail,local?:ClientRequest):ClientRequest{
  const d=parse(row.data),sd=parse(row.staff_data);
  const labels=d.fileLabels??{};
  const byRemote=new Map((local?.files??[]).filter(f=>f.remoteId).map(f=>[f.remoteId!,f]));
  const files:ClientFile[]=det.files.map(f=>{
    const l=byRemote.get(f.id),kind=f.kind??'source';
    const label=kind!=='source'?{ar:f.label||f.name,en:f.label||f.name}:(l?.label??labels[f.id]?.label??{ar:f.name,en:f.name});
    return{id:l?.id??f.id,remoteId:f.id,name:f.name,mime:f.mime,size:f.size,kind,label,createdAt:iso(f.created_at)};
  });
  files.push(...(local?.files??[]).filter(f=>!f.remoteId)); // picked but not uploaded yet
  const localIdOf=(remote:string)=>files.find(f=>f.remoteId===remote)?.id??remote;
  const localMissing=new Map((local?.missing??[]).map(m=>[m.id,m]));
  const missing:MissingDocument[]=(det.missing??[]).map(m=>{
    const keepLocal=!m.replacement_file_id?localMissing.get(m.id)?.replacement:undefined; // chosen on the phone, upload still pending
    const replacement=m.replacement_file_id?localIdOf(m.replacement_file_id):keepLocal;
    return{id:m.id,label:{ar:m.label_ar,en:m.label_en},note:{ar:m.note_ar,en:m.note_en},...(replacement?{replacement}:{})};
  });
  const events=(det.events??[]).map(e=>({id:e.id,at:iso(e.created_at),text:{ar:e.text_ar,en:e.text_en}}));
  const finals=files.filter(f=>f.kind==='final');
  const completedAt:string|undefined=row.status==='completed'?(sd.completedAt??iso(row.updated_at)):undefined;
  const base:ClientRequest=local??{
    id:row.id,serviceId:row.service_id,actionId:d.actionId??'',title:d.title??{ar:'طلب',en:'Request'},createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),
    status:row.status,stage:STAGE[row.status],name:d.name??'',phone:d.phone??'',fields:d.fields??{},files:[],missing:[],events:[],
    money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false},termsVersion:d.termsVersion,termsAcceptedAt:d.termsAcceptedAt,renewalOf:d.renewalOf,
  };
  const out:ClientRequest={...base,remoteId:row.id,status:row.status,stage:STAGE[row.status],updatedAt:iso(row.updated_at),files,missing,events:events.length?events:base.events,syncedAt:iso(row.updated_at)};
  if(sd.expectedAt)out.expectedAt=new Date(sd.expectedAt+'T00:00:00+04:00').toISOString();else delete out.expectedAt;
  if(completedAt)out.completedAt=completedAt;else delete out.completedAt;
  if(row.status==='completed'&&finals.length)out.deliveredAt=completedAt;else delete out.deliveredAt;
  if(sd.issue)out.issue=sd.issue;else delete out.issue;
  return out;
}
