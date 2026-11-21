/**
 * Request details — glass redesign (replaces the legacy `DetailDesign`).
 *
 * Shown by ClientWorkspace for the selected request. ClientWorkspace keeps ownership of state and side effects
 * (saving, sharing, files, receipt, problem report, payments) and of the Android back button for this layer
 * (share sheet → files/missing tab → details → list); this component renders them and calls back.
 *
 *  - Data: the synced `ClientRequest` is shown at once; on open a fresh copy comes from `fetchRequest`
 *    (GET /v1/requests/:id) unless local changes are still waiting to upload. Pull-to-refresh runs the app's full sync.
 *  - Fonts: `Txt` (Cairo for Arabic, system font for English). Icons: `Icon`. Touch: `Pressable` from Touch.tsx.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Linking,Platform,RefreshControl,StyleSheet,View} from 'react-native';
import {Icon} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {GlassButton,GlassCard,GlassField,GlassScreen,IconButton,Note,ScreenHeader,SectionTitle,StageTracker,StatusBadge,Tag,ValueRow,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {dateText,remaining,total,type ClientFile,type ClientRequest} from '../clientModel';
import {ApiError,apiEnabled,fetchRequest,hasSession,needsSync} from '../api';

const SUPPORT_WHATSAPP='https://wa.me/971585144005';
const SUPPORT_PHONE='tel:+971525949522';

const COPY={
  ar:{title:'تفاصيل المعاملة',back:'رجوع',reference:'رقم الطلب',sample:'بيانات توضيحية',status:'الحالة',
    submitted:'التقديم',completed:'الإنجاز',expected:'الإنجاز المتوقع',received:'الاستلام',delivered:'التسليم',
    actionNeeded:'مطلوب منك',whereAmI:'أين وصلت معاملتي؟',completeDocs:'استكمال المستندات',
    progress:'حالة المعاملة',stage:(n:string,of:string)=>`المرحلة ${n} من ${of}`,
    financial:'التفاصيل المالية',inAed:'جميع المبالغ بالدرهم الإماراتي',govFeesAuthority:'رسوم حكومية (للجهة مباشرة)',govFees:'الرسوم الحكومية',
    companyFee:'أتعاب الشركة',tax:'الضريبة',taxOff:'غير مهيأة',total:'الإجمالي',paid:'المدفوع',due:'المتبقي',
    awaitingQuote:'بانتظار عرض السعر المعتمد',illustrative:'أرقام توضيحية وليست تسعيرة معتمدة',
    finalDocs:'الملفات النهائية',noFinal:'لم تُسلّم ملفات نهائية بعد',allFiles:'كل ملفات المعاملة',view:'معاينة',save:'تنزيل',
    delivery:'حالة التسليم',receiptDone:'تم تأكيد الاستلام',receiptWaiting:'بانتظار تأكيد الاستلام',confirmReceipt:'تأكيد استلام الملفات',
    reportProblem:'الإبلاغ عن مشكلة',closeReport:'إغلاق البلاغ',issueLabel:'وصف المشكلة',issuePlaceholder:'اشرح المشكلة',sendIssue:'إرسال البلاغ للفريق',
    issueSent:'سُجّل بلاغك وسيتابعه الفريق.',
    history:'سجل المعاملة',noUpdates:'لا توجد تحديثات إضافية',
    exportWeb:'تنزيل ملخص PDF',exportNative:'مشاركة ملخص نصي',share:'مشاركة',
    contactSupport:'تواصل مع الدعم',contactSupportA11y:'التواصل مع الدعم عبر واتساب',opening:'جارٍ الفتح…',
    supportError:'تعذّر فتح واتساب أو الهاتف. اتصل بنا على ‎+971 52 594 9522',
    refreshing:'جارٍ تحديث المعاملة…',offline:'تعذّر التحديث. تُعرض آخر بيانات محفوظة.',notFound:'لم تعد هذه المعاملة متاحة في حسابك.',retry:'إعادة المحاولة',
    supportText:(ref:string)=>`مرحباً، أحتاج مساعدة بخصوص المعاملة رقم ${ref}`},
  en:{title:'Request details',back:'Go back',reference:'Request',sample:'Sample data',status:'Status',
    submitted:'Submitted',completed:'Completed',expected:'Expected',received:'Received',delivered:'Delivered',
    actionNeeded:'Action needed',whereAmI:'Where is my transaction?',completeDocs:'Complete documents',
    progress:'Request status',stage:(n:string,of:string)=>`Stage ${n} of ${of}`,
    financial:'Financial details',inAed:'All amounts in UAE dirhams',govFeesAuthority:'Govt fees (paid to authority)',govFees:'Government fees',
    companyFee:'Company fee',tax:'Tax',taxOff:'Not configured',total:'Total',paid:'Paid',due:'Due',
    awaitingQuote:'Awaiting an approved quote',illustrative:'Illustrative amounts, not an approved quotation',
    finalDocs:'Final documents',noFinal:'No final files delivered yet',allFiles:'All request files',view:'View',save:'Save',
    delivery:'Delivery status',receiptDone:'Receipt confirmed',receiptWaiting:'Awaiting receipt confirmation',confirmReceipt:'Confirm file receipt',
    reportProblem:'Report a problem',closeReport:'Close report',issueLabel:'Describe the issue',issuePlaceholder:'Describe the problem',sendIssue:'Send the report to the team',
    issueSent:'Your report is recorded; the team will follow up.',
    history:'Request history',noUpdates:'No additional updates',
    exportWeb:'Save PDF summary',exportNative:'Share text summary',share:'Share',
    contactSupport:'Contact Support',contactSupportA11y:'Contact support on WhatsApp',opening:'Opening…',
    supportError:'Could not open WhatsApp or the phone app. Call us on +971 52 594 9522.',
    refreshing:'Updating this request…',offline:'Could not refresh. Showing the last saved data.',notFound:'This request is no longer available in your account.',retry:'Try again',
    supportText:(ref:string)=>`Hello, I need help with request ${ref}`},
} as const;

const amount=(fils:number)=>ltr((fils/100).toFixed(2));

export type DetailsActions={
  onFiles:()=>void;onShare:()=>void;onReceipt:()=>void;onExport:()=>void;onMissing:()=>void;
  onViewFile:(f:ClientFile)=>void;onSaveFile:(f:ClientFile)=>void;
  issue:{open:boolean;text:string;setText:(v:string)=>void;toggle:()=>void;send:()=>void};
};

type Props={
  lang:Lang;
  request:ClientRequest;
  onBack:()=>void;
  actions:DetailsActions;
  /** True while an action runs (buttons are disabled, one action at a time). */
  busy?:boolean;
  /** Outcome / error text from the last action. */
  message?:string;
  /** Invoice & payment panel (rendered by the caller with its own state). */
  financePanel?:React.ReactNode;
  /** Full app sync (push local changes, then pull); used by pull-to-refresh. */
  onRefresh?:()=>Promise<void>|void;
  /** Receives the fresh server copy so the caller can store it. */
  onUpdated?:(r:ClientRequest)=>void;
};

type Sync={kind:'idle'}|{kind:'loading'}|{kind:'error';notFound:boolean};

export function TransactionDetailsScreen({lang,request,onBack,actions,busy=false,message,financePanel,onRefresh,onUpdated}:Props){
  const t=COPY[lang],row=rowFor(lang);
  const reduce=useReduceTransparency();
  const [sync,setSync]=useState<Sync>({kind:'idle'});
  const [refreshing,setRefreshing]=useState(false);
  const [supportBusy,setSupportBusy]=useState(false);
  const [supportError,setSupportError]=useState(false);
  const mounted=useRef(true),supportLock=useRef(false),run=useRef(0);
  const latest=useRef(request);latest.current=request;
  const onUpdatedRef=useRef(onUpdated);onUpdatedRef.current=onUpdated;
  const r=request;
  const live=!!r.remoteId&&!r.sample&&apiEnabled&&hasSession();

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);

  /** Fresh server copy. Skipped while local changes wait to upload, so they are never overwritten. */
  const load=useCallback(async()=>{
    const cur=latest.current;
    if(!live||!cur.remoteId||needsSync(cur))return;
    const id=++run.current;
    setSync({kind:'loading'});
    try{
      const fresh=await fetchRequest(cur.remoteId,cur);
      if(!mounted.current||id!==run.current)return;
      if(!needsSync(latest.current))onUpdatedRef.current?.(fresh);
      setSync({kind:'idle'});
    }catch(e){
      if(!mounted.current||id!==run.current)return;
      // 401 is handled by the api client (refresh, then the session-expired handler).
      setSync({kind:'error',notFound:e instanceof ApiError&&e.status===404});
    }
  },[live]);

  useEffect(()=>{void load()},[r.remoteId,load]);

  const pull=async()=>{
    setRefreshing(true);
    try{if(onRefresh)await onRefresh();else await load()}finally{if(mounted.current)setRefreshing(false)}
  };

  async function contactSupport(){
    if(supportLock.current)return;
    supportLock.current=true;setSupportBusy(true);setSupportError(false);
    const ref=r.remoteId&&r.remoteId!==r.id?`${r.id} (${r.remoteId})`:r.id;
    try{
      // Opens WhatsApp with a prefilled message; nothing is sent automatically.
      try{await Linking.openURL(`${SUPPORT_WHATSAPP}?text=${encodeURIComponent(t.supportText(ref))}`)}
      catch{await Linking.openURL(SUPPORT_PHONE)}
    }catch{if(mounted.current)setSupportError(true)}
    finally{supportLock.current=false;if(mounted.current)setSupportBusy(false)}
  }

  const done=r.status==='completed';
  const hasFinal=r.files.some(f=>f.kind==='final');
  const deliverables=r.files.filter(f=>f.kind==='final'||f.kind==='invoice');
  const dates:[string,string|undefined][]=[
    [t.submitted,r.createdAt],
    r.completedAt?[t.completed,r.completedAt]:[t.expected,r.expectedAt],
    r.acknowledgedAt?[t.received,r.acknowledgedAt]:[t.delivered,r.deliveredAt],
  ];
  const moneyRows:[string,number|null][]=[
    [r.finance?t.govFeesAuthority:t.govFees,r.money.government],[t.companyFee,r.money.handling],
    [t.tax,r.money.taxConfigured===false?null:r.money.tax],[t.total,total(r)],[t.paid,r.money.paid],[t.due,remaining(r)],
  ];
  const events=r.events.slice(-5);

  return <GlassScreen refreshControl={live||onRefresh?<RefreshControl refreshing={refreshing} onRefresh={()=>void pull()} tintColor={colors.orange} colors={[colors.orange]}/>:undefined}>
        <ScreenHeader lang={lang} title={t.title} backLabel={t.back} onBack={onBack}/>

        {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}
        {sync.kind==='loading'&&<View accessible accessibilityLabel={t.refreshing} accessibilityState={{busy:true}} style={[styles.syncRow,{flexDirection:row}]}>
          <ActivityIndicator color={colors.orange}/>
          <Txt lang={lang} style={styles.syncText}>{t.refreshing}</Txt>
        </View>}
        {sync.kind==='error'&&<View style={[styles.syncRow,styles.syncError,{flexDirection:row}]}>
          <Icon name="info" size={20} color={colors.danger}/>
          <View style={g.flex1}><Txt lang={lang} style={{...styles.syncText,color:colors.danger}}>{sync.notFound?t.notFound:t.offline}</Txt></View>
          {!sync.notFound&&<GlassButton lang={lang} compact label={t.retry} onPress={()=>void load()}/>}
        </View>}

        {/* Summary */}
        <GlassCard reduce={reduce}>
          <View style={[styles.summaryTop,{flexDirection:row}]}>
            <View style={styles.documentIcon}><Icon name="file" size={26} color={colors.orange}/></View>
            <View style={[g.flex1,styles.summaryText]}>
              <Txt lang={lang} bold style={styles.transactionTitle}>{r.title[lang]}</Txt>
              <Txt lang={lang} style={styles.reference}>{t.reference} {ltr('#'+r.id.replace('DEMO-',''))}</Txt>
            </View>
          </View>
          <View style={[styles.badges,{flexDirection:row}]}>
            <StatusBadge lang={lang} status={r.status}/>
            {r.sample&&<Tag lang={lang}>{t.sample}</Tag>}
          </View>
          <View style={[styles.dates,{flexDirection:row}]}>
            {dates.map(([label,v])=><View key={label} style={styles.dateCell}>
              <Txt lang={lang} style={styles.dateLabel}>{label}</Txt>
              <Txt lang={lang} bold style={styles.dateValue}>{dateText(v,lang)}</Txt>
            </View>)}
          </View>
        </GlassCard>

        {/* Where it stands / what is needed */}
        {r.whatNow&&<GlassCard reduce={reduce} tone={r.whatNow.actionRequired?'warning':'success'}>
          <View accessibilityRole="summary" style={styles.whatNow}>
            <Txt lang={lang} bold style={g.sectionTitle}>{r.whatNow.actionRequired?t.actionNeeded:t.whereAmI}</Txt>
            <Txt lang={lang} style={styles.body}>{r.whatNow[lang]}</Txt>
          </View>
          {r.status==='needs_documents'&&<GlassButton lang={lang} primary icon="upload" label={t.completeDocs} disabled={busy} onPress={actions.onMissing}/>}
        </GlassCard>}
        {!r.whatNow&&r.status==='needs_documents'&&<GlassButton lang={lang} primary icon="upload" label={t.completeDocs} disabled={busy} onPress={actions.onMissing}/>}

        {/* Progress steps */}
        {!done&&<GlassCard reduce={reduce}><StageTracker lang={lang} stage={r.stage}/></GlassCard>}

        {/* Financial details */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.financial}</SectionTitle>
          <Note lang={lang}>{t.inAed}</Note>
          {r.money.quoted
            ?<View>{moneyRows.map(([label,v],i)=><ValueRow key={label} lang={lang} label={label} strong={i>=3} highlight={i===3}
                value={v===null?t.taxOff:amount(v)} last={i===moneyRows.length-1}/>)}</View>
            :<Txt lang={lang} style={styles.body}>{t.awaitingQuote}</Txt>}
          {r.sample&&<Note lang={lang} tone="warning">{t.illustrative}</Note>}
        </GlassCard>

        {/* Invoice & payment */}
        {financePanel}

        {/* Final documents */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.finalDocs}</SectionTitle>
          {deliverables.length>0&&<View>
            {deliverables.map((f,i)=><View key={f.id} style={[styles.fileRow,{flexDirection:row},i===deliverables.length-1&&g.noBorder]}>
              <Icon name={f.kind==='invoice'?'card':'file'} size={20} color={colors.orange}/>
              <View style={g.flex1}>
                <Txt lang={lang} bold style={styles.fileName} numberOfLines={2}>{f.label[lang]}</Txt>
                <Txt lang={lang} style={styles.meta} numberOfLines={1}>{f.name}</Txt>
              </View>
              <IconButton icon="eye" label={`${t.view} ${f.label[lang]}`} disabled={busy} onPress={()=>actions.onViewFile(f)}/>
              <IconButton icon="download" label={`${t.save} ${f.label[lang]}`} disabled={busy} onPress={()=>actions.onSaveFile(f)}/>
            </View>)}
          </View>}
          {!hasFinal&&<Txt lang={lang} style={styles.body}>{t.noFinal}</Txt>}
          {r.files.length>0&&<GlassButton lang={lang} icon="folder" label={t.allFiles} disabled={busy} onPress={actions.onFiles}/>}
        </GlassCard>

        {/* Delivery: receipt confirmation and problem report */}
        {done&&<GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.delivery}</SectionTitle>
          <Note lang={lang} tone={r.acknowledgedAt?'success':'warning'}>{r.acknowledgedAt?t.receiptDone:t.receiptWaiting}</Note>
          <GlassButton lang={lang} primary icon="check" label={t.confirmReceipt} disabled={!!r.acknowledgedAt||!hasFinal} busy={busy&&!r.acknowledgedAt&&hasFinal} onPress={actions.onReceipt}/>
          <GlassButton lang={lang} icon={actions.issue.open?'close':'info'} label={actions.issue.open?t.closeReport:t.reportProblem} onPress={actions.issue.toggle}/>
          {actions.issue.open&&<View style={styles.issue}>
            <GlassField lang={lang} label={t.issueLabel} placeholder={t.issuePlaceholder} multiline value={actions.issue.text} onChangeText={actions.issue.setText}/>
            <GlassButton lang={lang} primary label={t.sendIssue} disabled={!actions.issue.text.trim()||busy} onPress={actions.issue.send}/>
          </View>}
          {!!r.issue&&!actions.issue.open&&<Note lang={lang}>{t.issueSent}</Note>}
        </GlassCard>}

        {/* History */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.history}</SectionTitle>
          {events.length>0?<View>
            {events.map((ev,i)=>{const last=i===events.length-1;return <View key={ev.id} style={[styles.event,{flexDirection:row}]}>
              <View style={styles.eventRail}>
                <View style={[styles.eventDot,last&&styles.eventDotNow]}/>
                {!last&&<View style={styles.eventLine}/>}
              </View>
              <View style={[g.flex1,!last&&styles.eventGap]}>
                <Txt lang={lang} style={styles.body}>{ev.text[lang]}</Txt>
                <Txt lang={lang} style={styles.meta}>{dateText(ev.at,lang)}</Txt>
              </View>
            </View>})}
          </View>:<Txt lang={lang} style={styles.body}>{t.noUpdates}</Txt>}
        </GlassCard>

        {/* Export / share */}
        <View style={[styles.actionsRow,{flexDirection:row}]}>
          <GlassButton lang={lang} fill icon="download" label={Platform.OS==='web'?t.exportWeb:t.exportNative} disabled={busy} onPress={actions.onExport}/>
          <GlassButton lang={lang} fill icon="arrows" label={t.share} disabled={busy} onPress={actions.onShare}/>
        </View>

        {/* Support */}
        <View style={styles.supportBlock}>
          <GlassButton lang={lang} icon="mail" accessibilityLabel={t.contactSupportA11y} label={supportBusy?t.opening:t.contactSupport} busy={supportBusy} onPress={()=>void contactSupport()}/>
          {supportError&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={styles.errorText}>{t.supportError}</Txt></View>}
        </View>
  </GlassScreen>;
}

const styles=StyleSheet.create({


  syncRow:{alignItems:'center',gap:space.sm,padding:space.md,borderRadius:radius.control,backgroundColor:colors.white},
  syncError:{backgroundColor:'#FBE6E3'},
  syncText:{fontSize:type.subhead,lineHeight:22,color:colors.muted},

  summaryTop:{alignItems:'center',gap:space.md},
  summaryText:{gap:2},
  documentIcon:{width:52,height:52,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint},
  transactionTitle:{fontSize:type.title2,lineHeight:32},
  reference:{fontSize:type.subhead,lineHeight:22,color:colors.muted},
  badges:{flexWrap:'wrap',gap:space.sm},
  dates:{borderTopWidth:layout.hairline,borderTopColor:colors.line,paddingTop:space.md,gap:space.sm},
  dateCell:{flex:1,gap:2},
  dateLabel:{fontSize:type.caption,lineHeight:18,color:colors.muted,textAlign:'center'},
  dateValue:{fontSize:type.footnote+1,lineHeight:20,textAlign:'center'},

  whatNow:{gap:space.xs},
  body:{fontSize:type.subhead,lineHeight:24,color:onGlass.soft},


  fileRow:{alignItems:'center',gap:space.sm+2,paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  fileName:{fontSize:type.subhead,lineHeight:22},
  meta:{fontSize:type.caption,lineHeight:18,color:colors.muted},

  issue:{gap:space.md},

  event:{gap:space.md},
  eventRail:{alignItems:'center',width:14},
  eventDot:{width:10,height:10,borderRadius:5,marginTop:9,backgroundColor:colors.line},
  eventDotNow:{backgroundColor:colors.orange},
  eventLine:{flex:1,width:2,backgroundColor:colors.line,marginVertical:space.xs},
  eventGap:{paddingBottom:space.lg},

  actionsRow:{gap:space.md,alignItems:'stretch'},
  supportBlock:{gap:space.sm+2},
  errorText:{fontSize:type.footnote+1,lineHeight:22,color:colors.danger,textAlign:'center'},
});
