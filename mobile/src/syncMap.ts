// Pure mapping between what the server stores and what the app shows. No React Native imports, so it can be tested in Node.
import type {ClientFile,ClientFinance,ClientRequest,MissingDocument,Status} from './clientModel';

export type ServerRow={id:string;service_id:string;status:Status;data:string;staff_data?:string;renewal_of:string|null;created_at:number;updated_at:number;delivery_version?:number;acknowledged_version?:number|null;acknowledged_at?:number|null};
export type ServerFile={id:string;name:string;mime:string;size:number;kind?:'source'|'final'|'invoice';label?:string|null;created_at:number};
export type ServerEvent={id:string;text_ar:string;text_en:string;created_at:number};
export type ServerMissing={id:string;label_ar:string;label_en:string;note_ar:string;note_en:string;replacement_file_id:string|null;resolved_at:number|null};
export type ServerFinance={credit?:{unallocated:number};gov?:{total:number;payUrl:string|null;verified:number;reported:number;remaining:number;state:string};authorityPayments?:{id:string;amount_fils:number;reference:string;status:string;created_at:number;note:string|null}[];quotes:{id:string;version:number;status:string;number:string|null;total_fils:number;items:{kind:string;description_ar:string;description_en:string;amount_fils:number}[]}[];payments:{id:string;kind:string;amount_fils:number;status:string;created_at:number;decision_note:string|null}[];documents:{id:string;doc_type:string;number:string;status:string;total_fils:number;created_at:number}[];totals:{total:number;paid:number;refunded:number;pending:number;remaining:number;state:string;invoice:{id:string;number:string;total:number}|null}};
export type ServerDetail={work?:{stage:{ar:string;en:string;actionRequired:boolean}};files:ServerFile[];events?:ServerEvent[];missing?:ServerMissing[];finance?:ServerFinance};

export const STAGE:Record<Status,1|2|3|4|5>={draft:1,submitted:1,review:2,needs_documents:2,ready_for_authority:2,authority:3,decision:4,completed:5,cancelled:1,rejected:5};
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

const sumKind=(items:{kind:string;amount_fils:number}[],k:string)=>items.filter(i=>i.kind===k).reduce((a,i)=>a+i.amount_fils,0);
/** Money as the customer sees it. Tax is NOT configured: it is shown as "not configured", never as zero. */
export function mapFinance(f:ServerFinance|undefined):{finance?:ClientFinance;money?:ClientRequest['money']}{
  if(!f)return{};
  const live=[...f.quotes].filter(q=>q.status==='issued'||q.status==='accepted').pop();
  const finance:ClientFinance={
    ...(f.credit&&f.credit.unallocated>0?{credit:f.credit.unallocated}:{}),
    ...(f.gov&&f.gov.total>0?{gov:{total:f.gov.total,payUrl:f.gov.payUrl,verified:f.gov.verified,reported:f.gov.reported,remaining:f.gov.remaining,state:f.gov.state,entries:(f.authorityPayments??[]).map(a=>({id:a.id,amount:a.amount_fils,reference:a.reference,status:a.status as 'reported'|'verified'|'rejected',at:iso(a.created_at),...(a.note?{note:a.note}:{})}))}}:{}),
    ...(live?{quote:{id:live.id,version:live.version,status:live.status as 'issued'|'accepted',number:live.number,total:live.total_fils,items:live.items.map(i=>({kind:i.kind as 'government_fee'|'service_fee',ar:i.description_ar,en:i.description_en,amount:i.amount_fils}))}}:{}),
    ...(f.totals.invoice?{invoice:{id:f.totals.invoice.id,number:f.totals.invoice.number,total:f.totals.invoice.total}}:{}),
    payments:f.payments.map(p=>({id:p.id,kind:p.kind as 'payment'|'refund',amount:p.amount_fils,status:p.status as 'pending_verification'|'approved'|'rejected',at:iso(p.created_at),...(p.decision_note?{note:p.decision_note}:{})})),
    documents:f.documents.map(d=>({id:d.id,type:d.doc_type as 'quote'|'invoice'|'receipt'|'credit_note',number:d.number,status:d.status as 'issued'|'void',total:d.total_fils,at:iso(d.created_at)})),
    totals:{total:f.totals.total,paid:f.totals.paid,refunded:f.totals.refunded,pending:f.totals.pending,remaining:f.totals.remaining,state:f.totals.state as ClientFinance['totals']['state']},
  };
  const items=live?.items??[];
  const money={government:sumKind(items,'government_fee'),handling:sumKind(items,'service_fee'),tax:0,extra:0,paid:f.totals.paid,refunded:f.totals.refunded,quoted:!!live,taxConfigured:false};
  return{finance,money};
}

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
  const fin=mapFinance(det.finance);
  const out:ClientRequest={...base,...(fin.money?{money:fin.money}:{}),...(fin.finance?{finance:fin.finance}:{}),remoteId:row.id,status:row.status,stage:STAGE[row.status],updatedAt:iso(row.updated_at),files,missing,events:events.length?events:base.events,syncedAt:iso(row.updated_at)};
  if(det.work?.stage)out.whatNow={ar:det.work.stage.ar,en:det.work.stage.en,actionRequired:det.work.stage.actionRequired};else delete out.whatNow; // server says where it stands and whether something is needed from the customer
  if(sd.expectedAt)out.expectedAt=new Date(sd.expectedAt+'T00:00:00+04:00').toISOString();else delete out.expectedAt;
  if(completedAt)out.completedAt=completedAt;else delete out.completedAt;
  if(row.status==='completed'&&finals.length)out.deliveredAt=completedAt;else delete out.deliveredAt;
  if(sd.issue)out.issue=sd.issue;else delete out.issue;
  // Receipt confirmation belongs to one delivery version: a newer delivery needs a new confirmation.
  const dv=row.delivery_version??0;
  if(dv>0)out.deliveryVersion=dv;else delete out.deliveryVersion;
  if(dv>0&&(row.acknowledged_version??0)>=dv&&row.acknowledged_at)out.acknowledgedAt=iso(row.acknowledged_at);else delete out.acknowledgedAt;
  return out;
}
