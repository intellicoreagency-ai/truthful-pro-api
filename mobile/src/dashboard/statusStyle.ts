import type {Status} from '../clientModel';

/** Badge tint per status (brand palette; text colours meet 4.5:1 on their fill). */
export const statusTone=(s:Status):{bg:string;fg:string}=>{
  switch(s){
    case 'completed':return {bg:'#E5F2D9',fg:'#2D681F'};
    case 'needs_documents':return {bg:'#F3EAD6',fg:'#6E5426'};
    case 'rejected':case 'cancelled':return {bg:'#FBE6E3',fg:'#A3261A'};
    case 'authority':case 'decision':return {bg:'#E4ECF8',fg:'#25477A'};
    default:return {bg:'#E6EAF2',fg:'#0B1F3A'};
  }
};
export type Bucket='all'|'active'|'action'|'done';
const CLOSED:Status[]=['completed','cancelled','rejected'];
export const inBucket=(r:{status:Status;whatNow?:{actionRequired:boolean}},b:Bucket)=>{
  if(b==='all')return true;
  if(b==='action')return r.status==='needs_documents'||!!r.whatNow?.actionRequired;
  if(b==='done')return r.status==='completed';
  return !CLOSED.includes(r.status)&&r.status!=='draft';
};
