/**
 * Invoice & payment panel of Request details (test copies; manual payments).
 * Moved from ClientWorkspace.tsx with its logic unchanged; only the presentation is the glass design.
 */
import React,{useRef,useState} from 'react';
import {Linking,View} from 'react-native';
import {Txt,type Lang} from '../ui/Txt';
import {GlassButton,GlassCard,GlassField,Note,SectionTitle,ValueRow,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {makeId,type ClientFile,type ClientFinance,type ClientRequest} from '../clientModel';
import {getBytes,openHtmlDocument,pickClientFile} from '../clientStorage';
import {fetchDocumentHtml,reportAuthorityPayment,submitPayment} from '../api';

type Act=(fn:()=>Promise<void>|void)=>void;

export const aed=(fils:number)=>'AED '+String(Math.floor(Math.abs(fils)/100)).replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+String(Math.abs(fils)%100).padStart(2,'0');
/** "350.50" -> 35050 with integer arithmetic only. */
export const aedToFils=(v:string)=>{const m=/^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(v.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)));if(!m)return null;const n=Number(m[1])*100+Number((m[2]??'').padEnd(2,'0'));return n>0?n:null};
const money=(fils:number)=>ltr(aed(fils));
const refPattern=/^[A-Za-z0-9 ._/-]{4,60}$/;

function GovSection({lang,r,gov,act,onChanged,setMessage}:{lang:Lang;r:ClientRequest;gov:NonNullable<ClientFinance['gov']>;act:Act;onChanged:()=>void;setMessage:(m:string)=>void}){
  const ar=lang==='ar',tx=(a:string,e:string)=>ar?a:e;
  const [open,setOpen]=useState(false);const [amount,setAmount]=useState('');const [reference,setReference]=useState('');const [proof,setProof]=useState<ClientFile|null>(null);
  const keyRef=useRef('gov-'+makeId()+makeId());
  const st:Record<string,[string,string]>={reported:['بانتظار التحقق','Awaiting verification'],verified:['تم التحقق','Verified'],rejected:['مرفوض','Rejected']};
  const room=Math.max(0,gov.total-gov.verified-gov.reported);
  const fils=aedToFils(amount);const refOk=refPattern.test(reference.trim());
  const send=()=>act(async()=>{if(!fils||!refOk||!r.remoteId||fils>room)return;try{await reportAuthorityPayment(r.remoteId,proof,proof?await getBytes(proof):null,{amountFils:fils,reference:reference.trim(),clientKey:keyRef.current});keyRef.current='gov-'+makeId()+makeId();setOpen(false);setAmount('');setReference('');setProof(null);onChanged()}catch(e){const c=(e as {code?:string}).code;setMessage(c==='exceeds_balance'?tx('المبلغ يتجاوز الرسوم الحكومية','Amount exceeds the government fees'):c==='reference_used'?tx('هذا المرجع مسجل مسبقاً','This reference is already recorded'):tx('تعذر الإرسال','Could not send'))}});
  return <View style={{gap:12}}>
    <Txt lang={lang} bold style={g.sectionTitle}>{tx('الرسوم الحكومية — تُدفع مباشرة للجهة','Government fees — paid directly to the authority')}</Txt>
    <Txt lang={lang} style={g.noteText}>{tx('تُسدَّد للجهة الحكومية عبر الرابط الرسمي وفق التعرفة الحكومية. لا تحصّلها الشركة، وتتقاضى الشركة أتعابها فقط.','Paid to the government authority through the official link at the official tariff. The Company does not collect them; it only charges its own fee.')}</Txt>
    <View>
      <ValueRow lang={lang} label={tx('الرسوم الحكومية','Government fees')} value={money(gov.total)}/>
      <ValueRow lang={lang} label={tx('تم التحقق منها','Verified')} value={money(gov.verified)}/>
      <ValueRow lang={lang} label={tx('المتبقي','Remaining')} value={money(gov.remaining)} strong last/>
    </View>
    {gov.payUrl
      ?<GlassButton lang={lang} primary icon="arrows" label={tx('فتح رابط الدفع الرسمي','Open the official payment link')} onPress={()=>{if(/^https:\/\//i.test(gov.payUrl!))void Linking.openURL(gov.payUrl!)}}/>
      :<Note lang={lang}>{tx('سيضيف الفريق رابط الدفع الرسمي قريباً','The team will add the official payment link shortly')}</Note>}
    {gov.entries.map(e=><Txt key={e.id} lang={lang} style={g.noteText}>{money(e.amount)} · {ltr(e.reference)} · {st[e.status]?.[ar?0:1]}{e.note?' · '+e.note:''}</Txt>)}
    {room>0&&!open&&<GlassButton lang={lang} icon="upload" label={tx('أبلغ بأنك دفعت للجهة','Report that you paid the authority')} onPress={()=>setOpen(true)}/>}
    {open&&<View style={{gap:12}}>
      <GlassField lang={lang} label={tx('المبلغ بالدرهم (حتى '+aed(room)+')','Amount in AED (up to '+aed(room)+')')} accessibilityLabel={tx('المبلغ','Amount')} keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
      <GlassField lang={lang} label={tx('رقم إيصال/عملية الجهة','Authority receipt / transaction number')} accessibilityLabel={tx('رقم العملية','Transaction number')} autoCapitalize="characters" value={reference} onChangeText={setReference}/>
      <GlassButton lang={lang} icon="upload" label={proof?proof.name:tx('إرفاق الإيصال (اختياري)','Attach receipt (optional)')} onPress={()=>act(async()=>{const x=await pickClientFile({ar:'إيصال الجهة',en:'Authority receipt'});if(x)setProof(x)})}/>
      <GlassButton lang={lang} primary disabled={!fils||!refOk||fils>room} label={tx('إرسال للتحقق','Send for verification')} onPress={send}/>
      <GlassButton lang={lang} label={tx('إلغاء','Cancel')} onPress={()=>setOpen(false)}/>
    </View>}
  </View>;
}

export function FinancePanel({lang,r,act,onChanged,setMessage}:{lang:Lang;r:ClientRequest;act:Act;onChanged:()=>void;setMessage:(m:string)=>void}){
  const ar=lang==='ar',row=rowFor(lang),tx=(a:string,e:string)=>ar?a:e;
  const reduce=useReduceTransparency();
  const f=r.finance!;const [open,setOpen]=useState(false);const [amount,setAmount]=useState('');const [reference,setReference]=useState('');const [proof,setProof]=useState<ClientFile|null>(null);
  const keyRef=useRef('pay-'+makeId()+makeId());
  const kind:Record<string,[string,string]>={government_fee:['رسوم حكومية (تُدفع للجهة)','Government fee (paid to authority)'],service_fee:['أتعاب الشركة','Company fee']};
  const state:Record<string,[string,string]>={unpriced:['غير مسعّر','Not priced'],awaiting_payment:['بانتظار الدفع','Awaiting payment'],partial:['مدفوع جزئياً','Partly paid'],paid:['مدفوع','Paid'],refunded:['مسترد','Refunded']};
  const pst:Record<string,[string,string]>={pending_verification:['بانتظار التحقق','Awaiting verification'],approved:['معتمدة','Approved'],rejected:['مرفوضة','Rejected']};
  const dtype:Record<string,[string,string]>={quote:['عرض سعر','Quotation'],invoice:['فاتورة','Invoice'],receipt:['إيصال','Receipt'],credit_note:['إشعار دائن','Credit note']};
  const room=f.totals.remaining-f.totals.pending;
  const fils=aedToFils(amount);const refOk=refPattern.test(reference.trim());
  const send=()=>act(async()=>{if(!fils||!refOk||!proof||!r.remoteId)return;try{await submitPayment(r.remoteId,proof,await getBytes(proof),{amountFils:fils,reference:reference.trim(),clientKey:keyRef.current});keyRef.current='pay-'+makeId()+makeId();setOpen(false);setAmount('');setReference('');setProof(null);onChanged()}catch(e){const c=(e as {code?:string}).code;setMessage(c==='exceeds_balance'?tx('المبلغ يتجاوز المتبقي على الفاتورة','The amount exceeds the invoice balance'):c==='reference_used'?tx('مرجع التحويل مسجّل مسبقاً','That transfer reference is already registered'):tx('تعذّر إرسال الدفعة. حاول مجدداً','Could not send the payment. Try again'))}});
  const totalsRows:[string,number][]=[[tx('الإجمالي','Total'),f.totals.total],[tx('المدفوع','Paid'),f.totals.paid],[tx('بانتظار التحقق','Awaiting verification'),f.totals.pending],[tx('المسترد','Refunded'),f.totals.refunded],[tx('المتبقي','Remaining'),f.totals.remaining]];
  return <GlassCard reduce={reduce}>
    <SectionTitle lang={lang}>{tx('الفاتورة والدفع','Invoice & payment')}</SectionTitle>
    <Note lang={lang} tone="danger">{tx('نسخة تجريبية — لا قيمة مالية لهذه المستندات','TEST COPY — these documents have no financial value')}</Note>
    {f.quote?<View>
      {f.quote.items.filter(i=>i.kind==='service_fee').map((i,k)=><ValueRow key={k} lang={lang} label={`${kind[i.kind]?.[ar?0:1]}: ${i[lang]}`} value={money(i.amount)}/>)}
      <ValueRow lang={lang} strong last label={`${tx('إجمالي أتعاب الشركة','Company fee total')}${f.invoice?.number?' ('+ltr(f.invoice.number)+')':''}`} value={money(f.quote.total)}/>
      <Txt lang={lang} style={g.noteText}>{tx('الضريبة غير مهيأة ولم تُحتسب. هذه المستندات ليست فواتير ضريبية.','Tax is not configured and was not calculated. These are not tax invoices.')}</Txt>
    </View>:<Note lang={lang}>{tx('بانتظار إصدار الفاتورة من الفريق','Waiting for the team to issue your invoice')}</Note>}
    {(f.credit??0)>0&&<Note lang={lang} tone="success">{tx('رصيدك الدائن لدينا (مبلغ زائد لم يُخصص لمعاملة): ','Your credit with us (excess not allocated to a transaction): ')}{money(f.credit!)}</Note>}
    {f.gov&&f.invoice&&<View style={g.note}>
      <Txt lang={lang} bold>{tx('التكلفة الكاملة لمعاملتك','Full cost of your transaction')}</Txt>
      <ValueRow lang={lang} label={tx('أتعاب الشركة','Company fee')} value={money(f.totals.total)}/>
      <ValueRow lang={lang} label={tx('الرسوم الحكومية (للجهة مباشرة)','Government fees (to the authority)')} value={money(f.gov.total)}/>
      <ValueRow lang={lang} strong last label={tx('الإجمالي','Total')} value={money(f.totals.total+f.gov.total)}/>
    </View>}
    {f.gov&&<GovSection lang={lang} r={r} gov={f.gov} act={act} onChanged={onChanged} setMessage={setMessage}/>}
    {f.invoice&&<View style={{gap:12}}>
      <View style={{flexDirection:row,alignItems:'center',justifyContent:'space-between',gap:12}}>
        <Txt lang={lang} bold style={g.sectionTitle}>{tx('حالة الدفع','Payment status')}</Txt>
        <View style={{backgroundColor:'#E8EDFB',borderRadius:999,paddingHorizontal:12,paddingVertical:4}}><Txt lang={lang} bold style={{fontSize:13,color:'#1D3A9E'}}>{state[f.totals.state]?.[ar?0:1]}</Txt></View>
      </View>
      <View>{totalsRows.map(([l,v],i)=><ValueRow key={l} lang={lang} label={l} value={money(v)} strong={i===totalsRows.length-1} last={i===totalsRows.length-1}/>)}</View>
      {f.payments.map(p=><Txt key={p.id} lang={lang} style={g.noteText}>{p.kind==='refund'?tx('استرداد','Refund'):tx('دفعة','Payment')} {money(p.amount)} · {pst[p.status]?.[ar?0:1]}{p.note?' · '+p.note:''}</Txt>)}
      {room>0&&!open&&<GlassButton lang={lang} icon="upload" label={tx('إبلاغ عن دفعة (تحويل بنكي)','Report a payment (bank transfer)')} onPress={()=>setOpen(true)}/>}
      {open&&<View style={{gap:12}}>
        <GlassField lang={lang} label={tx('المبلغ بالدرهم (حتى '+aed(room)+')','Amount in AED (up to '+aed(room)+')')} accessibilityLabel={tx('المبلغ','Amount')} keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
        <GlassField lang={lang} label={tx('مرجع التحويل','Transfer reference')} autoCapitalize="characters" value={reference} onChangeText={setReference}/>
        <GlassButton lang={lang} icon="upload" label={proof?proof.name:tx('اختيار إثبات التحويل','Choose transfer proof')} onPress={()=>act(async()=>{const x=await pickClientFile({ar:'إثبات دفع',en:'Payment proof'});if(x)setProof(x)})}/>
        <GlassButton lang={lang} primary disabled={!fils||!refOk||!proof||(fils??0)>room} label={tx('إرسال للتحقق','Send for verification')} onPress={send}/>
        <GlassButton lang={lang} label={tx('إلغاء','Cancel')} onPress={()=>setOpen(false)}/>
      </View>}
    </View>}
    {f.documents.length>0&&<View style={{gap:8}}>
      <Txt lang={lang} bold style={g.sectionTitle}>{tx('المستندات المالية','Financial documents')}</Txt>
      {f.documents.map(d=><View key={d.id} style={[g.valueRow,{flexDirection:row}]}>
        <View style={g.flex1}><Txt lang={lang} style={g.valueLabel}>{dtype[d.type]?.[ar?0:1]} · {ltr(d.number)}{d.status==='void'?' ('+tx('ملغى','void')+')':''}</Txt></View>
        <GlassButton lang={lang} compact label={tx('عرض','View')} accessibilityLabel={`${tx('عرض','View')} ${dtype[d.type]?.[ar?0:1]??''} ${d.number}`} onPress={()=>act(async()=>{await openHtmlDocument(d.number,await fetchDocumentHtml(d.id))})}/>
      </View>)}
    </View>}
  </GlassCard>;
}
