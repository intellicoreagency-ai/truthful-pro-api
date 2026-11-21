/**
 * My Requests coordinator: the list (DashboardScreen) and, for the selected request, its layers —
 * details, missing documents, files — plus the share sheet. Owns their state, side effects and the
 * Android back order (share sheet → files/missing → details → list).
 */
import React,{useEffect,useState} from 'react';
import {BackHandler,View} from 'react-native';
import {DashboardScreen,type SyncStatus} from './dashboard/DashboardScreen';
import {MissingDocumentsScreen} from './details/MissingDocumentsScreen';
import {RequestFilesScreen} from './details/RequestFilesScreen';
import {ShareSheet} from './details/ShareSheet';
import {TransactionDetailsScreen} from './details/TransactionDetailsScreen';
import {FinancePanel} from './details/FinancePanel';
import {event,confirmReceipt,canSendMissing,demoRequests,type ClientRequest,type ClientFile} from './clientModel';
import {pickClientFile,downloadFile,previewFile,shareRequest,exportSummary,seedDemoFiles} from './clientStorage';
import {reportDeliveryProblem} from './api';

type Lang='ar'|'en';
type Layer='detail'|'missing'|'files';
type Props={lang:Lang;onLanguage:()=>void;onFocusChange:(focused:boolean)=>void;records:ClientRequest[];save:(records:ClientRequest[])=>boolean;onStart:()=>void;onResume:(serviceId:string,actionId:string,draftId?:string,renewalOf?:string)=>void;drafts:{key:string;title:string;resume:()=>void}[];onRefresh?:()=>Promise<void>|void;syncStatus?:SyncStatus;loadedOnce?:boolean;};

export function ClientWorkspace({lang,onLanguage,onFocusChange,records,save,onStart,onResume,drafts,onRefresh,syncStatus='idle',loadedOnce=true}:Props){
 const ar=lang==='ar';const tx=(a:string,e:string)=>ar?a:e;
 const [demo,setDemo]=useState(false),[demoData,setDemoData]=useState<ClientRequest[]>([]);
 const [selected,setSelected]=useState<string|null>(null),[tab,setTabState]=useState<Layer>('detail'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [shareId,setShareId]=useState<string|null>(null),[shareDetailed,setShareDetailed]=useState(false),[financial,setFinancial]=useState(false),[shareFiles,setShareFiles]=useState<string[]>([]),
   [includeSummary,setIncludeSummary]=useState(true),[invoiceSelected,setInvoiceSelected]=useState(false),[shareEmail,setShareEmail]=useState('');
 const [issue,setIssue]=useState(''),[showIssue,setShowIssue]=useState(false);
 const all=demo?demoData:records;const current=all.find(r=>r.id===selected);const sharing=all.find(r=>r.id===shareId);
 /** Changing layer clears the previous layer's outcome message (it used to linger). */
 const setTab=(next:Layer)=>{setMessage('');setTabState(next)};
 useEffect(()=>{onFocusChange(!!selected||!!shareId&&shareDetailed);return ()=>onFocusChange(false)},[selected,shareId,shareDetailed]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!selected&&!shareId)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(shareId)setShareId(null);else if(tab!=='detail')setTab('detail');else setSelected(null);return true});return ()=>sub.remove()},[selected,shareId,tab]); // eslint-disable-line react-hooks/exhaustive-deps
 const act=async(fn:()=>Promise<void>|void)=>{if(busy)return;setBusy(true);setMessage('');try{await fn()}catch(e){const code=e instanceof Error?e.message:'';setMessage(code==='use-system'?tx('لمشاركة الملفات، استخدم «المزيد» على جهاز يدعم مشاركة الملفات، أو نزّلها وأرفقها بنفسك. لم يُرسل أي ملف.','To share attachments, use More on a device that supports file sharing, or download and attach them. No files were sent.'):code==='files-native'?tx('مشاركة المرفقات دفعة واحدة غير متاحة على هذا الجهاز. شارك كل ملف من «ملفات المعاملة». لم يُرسل أي ملف.','Sharing several attachments at once is not available on this device. Share each file from Request files. No files were sent.'):code==='share-unavailable'?tx('المشاركة غير متاحة على هذا الجهاز. لم يُرسل أي ملف.','Sharing is not available on this device. No files were sent.'):code==='missing'?tx('الملف غير موجود على هذا الجهاز.','The file is not stored on this device.'):code==='size'?tx('الحد الأقصى ٥ ميغابايت للملف.','Maximum file size: 5 MB.'):code==='empty'?tx('الملف فارغ. اختر ملفاً سليماً.','The file is empty. Choose a valid file.'):code==='format'?tx('اختر ملف PDF أو صورة JPG أو PNG سليمة.','Choose a valid PDF, JPG or PNG.'):tx('تعذر إكمال الإجراء. أعد المحاولة؛ لم تتغير حالة الطلب.','The action could not be completed. Retry; request status was not changed.'))}finally{setBusy(false)}};
 const update=(r:ClientRequest)=>{if(demo)setDemoData(a=>a.map(v=>v.id===r.id?r:v));else if(!save(records.map(v=>v.id===r.id?r:v)))throw Error('storage')};
 const startShare=(r:ClientRequest)=>{setShareId(r.id);setShareFiles([]);setFinancial(false);setIncludeSummary(true);setMessage('')};
 const openDetails=(r:ClientRequest)=>{if(r.status==='draft')onResume(r.serviceId,r.actionId,r.id);else {setSelected(r.id);setTab('detail')}};
 const pickMissing=(id:string)=>void act(async()=>{if(!current)return;const d=current.missing.find(d=>d.id===id);if(!d)return;const f=await pickClientFile(d.label);if(f)update(event({...current,files:[...current.files,f],missing:current.missing.map(x=>x.id===id?{...x,replacement:f.id}:x)},'أرفق العميل مستند استكمال','Client attached an additional document'))});
 const sendMissing=()=>void act(()=>{if(!current||!canSendMissing(current))return;update(event({...current,status:'review'},'تم استلام ملفات الاستكمال — بانتظار المراجعة','Additional files received — awaiting review'));setTabState('detail')});
 const selectedInvoices=sharing?.files.filter(f=>f.kind==='invoice')??[];
 const toggleInvoice=()=>{if(!selectedInvoices.length&&!invoiceSelected){setMessage(tx('لم تُرفق فاتورة بهذه المعاملة بعد.','No invoice has been attached to this request.'));return}setMessage('');setInvoiceSelected(!invoiceSelected);setShareFiles(a=>invoiceSelected?a.filter(id=>!selectedInvoices.some(f=>f.id===id)):[...new Set([...a,...selectedInvoices.map(f=>f.id)])])};
 const performShare=(channel:'email'|'whatsapp'|'system')=>void act(async()=>{if(!sharing)return;const outcome=await shareRequest(sharing,lang,includeSummary&&financial,shareFiles,channel,includeSummary,shareEmail);setMessage(outcome==='copied'?tx('نُسخ الملخص النصي إلى الحافظة فقط. لم يُرسل شيء ولم تُرفق ملفات.','Only the text summary was copied to the clipboard. Nothing was sent and no files were attached.'):outcome==='dismissed'?tx('أُلغيت المشاركة. لم يُرسل شيء.','Sharing was cancelled. Nothing was sent.'):tx('فُتح خيار المشاركة. لا يعني ذلك الإرسال أو تأكيد الاستلام.','Sharing opened. This does not confirm sending or receipt.'))});
 const viewFile=(r:ClientRequest)=>(f:ClientFile)=>void act(async()=>{await previewFile(f);update(event(r,'فتح العميل الملف للمعاينة','Client opened a file to view'))});
 const saveFile=(r:ClientRequest)=>(f:ClientFile)=>void act(async()=>{await downloadFile(f);update(event(r,'طلب العميل تنزيل ملف','Client requested a file download'))});

 let layer:React.ReactNode=null;
 if(current&&tab==='missing'&&current.status==='needs_documents')
   layer=<MissingDocumentsScreen lang={lang} r={current} busy={busy} message={message} onBack={()=>setTab('detail')} onPick={pickMissing} onSend={sendMissing}/>;
 else if(current&&tab==='files')
   layer=<RequestFilesScreen lang={lang} r={current} busy={busy} message={message} onBack={()=>setTab('detail')} onView={viewFile(current)} onSave={saveFile(current)}/>;
 else if(current)
   layer=<TransactionDetailsScreen lang={lang} request={current} busy={busy} message={message}
     onBack={()=>setSelected(null)}
     onRefresh={demo?undefined:onRefresh}
     onUpdated={fresh=>{try{update(fresh)}catch{/* storage full: keep showing the saved copy */}}}
     financePanel={!demo&&current.finance&&current.remoteId?<FinancePanel lang={lang} r={current} act={act} onChanged={()=>onRefresh?.()} setMessage={setMessage}/>:null}
     actions={{
       onFiles:()=>setTab('files'),
       onMissing:()=>setTab('missing'),
       onShare:()=>{setShareDetailed(true);setInvoiceSelected(false);startShare(current)},
       onReceipt:()=>void act(()=>update(confirmReceipt(current))),
       onExport:()=>void act(async()=>{await exportSummary(current,lang)}),
       onViewFile:viewFile(current),
       onSaveFile:saveFile(current),
       issue:{open:showIssue,text:issue,setText:setIssue,toggle:()=>setShowIssue(!showIssue),
         send:()=>void act(async()=>{if(current.remoteId&&!demo)await reportDeliveryProblem(current.remoteId,issue.trim());update(event({...current,issue:issue.trim()},'سجل العميل مشكلة في التسليم','Client reported a delivery problem'));setShowIssue(false)})},
     }}/>;

 return <View style={{flex:1}}>
   {layer??<DashboardScreen lang={lang} records={all} drafts={drafts} syncStatus={syncStatus} loadedOnce={loadedOnce} demo={demo} onRefresh={async()=>{await onRefresh?.()}}
     onOpen={openDetails} onMissing={r=>{setSelected(r.id);setTab('missing')}} onStart={onStart} onLanguage={onLanguage}
     onDemo={()=>void act(async()=>{if(!demoData.length)setDemoData(await seedDemoFiles(demoRequests()));setDemo(!demo)})}/>}
   <ShareSheet lang={lang} r={sharing} visible={!!sharing} onClose={()=>setShareId(null)} summary={includeSummary} financial={financial} selected={shareFiles}
     invoiceSelected={invoiceSelected} toggleSummary={()=>setIncludeSummary(!includeSummary)} toggleFinancial={()=>setFinancial(!financial)}
     toggleFile={id=>setShareFiles(a=>a.includes(id)?a.filter(v=>v!==id):[...a,id])} onInvoice={toggleInvoice} onShare={performShare}
     email={shareEmail} setEmail={setShareEmail} busy={busy} message={message}/>
 </View>;
}
