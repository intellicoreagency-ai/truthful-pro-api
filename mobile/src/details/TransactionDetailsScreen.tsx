/**
 * Step 5 — Transaction (request) details, glass redesign.
 *
 * Adapted from the reviewed draft to this project:
 *  - No Expo Router: the app routes with state in App.tsx / ClientWorkspace, so this is a component with
 *    `request` + `onBack` props (it replaces `DetailDesign` when wired in; see REFACTOR_PLAN.md).
 *  - Data: the synced `ClientRequest` is shown at once; a fresh copy comes from `fetchRequest`
 *    (GET /v1/requests/:id through the shared api client: bearer token, refresh, session expiry).
 *  - Fonts: `Txt` (Cairo for Arabic, system font for English). Icons: `Icon`. Touch: `Pressable` from Touch.tsx.
 *  - Status labels/tones from clientModel + statusStyle; money in fils via `money`; dates via `dateText` (Asia/Dubai).
 *  - Support goes to the company's real WhatsApp line, with phone as fallback.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,BackHandler,Linking,Platform,RefreshControl,StyleSheet,View} from 'react-native';
import {BlurView} from 'expo-blur';
import {Pressable} from '../Touch';
import {Icon,type IconName} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {ScrollView} from '../navigation/TabBarLayout';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {dateText,money,statusLabels,total,type ClientFile,type ClientRequest,type Status} from '../clientModel';
import {statusTone} from '../dashboard/statusStyle';
import {ApiError,apiEnabled,fetchRequest,hasSession} from '../api';

const SUPPORT_WHATSAPP='https://wa.me/971585144005';
const SUPPORT_PHONE='tel:+971525949522';

const COPY={
  ar:{title:'تفاصيل المعاملة',back:'رجوع',reference:'رقم المرجع',submitted:'تاريخ الإنشاء',updated:'آخر تحديث',expected:'الإنجاز المتوقع',
    toBeConfirmed:'سيتم التأكيد لاحقاً',total:'الإجمالي',notQuoted:'بانتظار التسعير',documents:'المستندات',history:'سجل المعاملة',
    whatNow:'المطلوب الآن',final:'ملف نهائي',invoice:'فاتورة',completeDocs:'استكمال المستندات',
    contactSupport:'تواصل مع الدعم',contactSupportA11y:'التواصل مع الدعم عبر واتساب',opening:'جارٍ الفتح…',
    supportError:'تعذّر فتح واتساب أو الهاتف. اتصل بنا على ‎+971 52 594 9522',
    refreshing:'جارٍ تحديث المعاملة…',offline:'تعذّر التحديث. تُعرض آخر بيانات محفوظة.',notFound:'لم تعد هذه المعاملة متاحة في حسابك.',
    retry:'إعادة المحاولة',status:'الحالة',supportText:(ref:string)=>`مرحباً، أحتاج مساعدة بخصوص المعاملة رقم ${ref}`},
  en:{title:'Transaction Details',back:'Go back',reference:'Reference',submitted:'Created',updated:'Last updated',expected:'Expected completion',
    toBeConfirmed:'To be confirmed',total:'Total',notQuoted:'Not quoted yet',documents:'Documents',history:'Request history',
    whatNow:'What happens now',final:'Final file',invoice:'Invoice',completeDocs:'Complete documents',
    contactSupport:'Contact Support',contactSupportA11y:'Contact support on WhatsApp',opening:'Opening…',
    supportError:'Could not open WhatsApp or the phone app. Call us on +971 52 594 9522.',
    refreshing:'Updating this transaction…',offline:'Could not refresh. Showing the last saved data.',notFound:'This transaction is no longer available in your account.',
    retry:'Try again',status:'Status',supportText:(ref:string)=>`Hello, I need help with request ${ref}`},
} as const;

/** Keeps references, amounts and phone numbers left-to-right inside Arabic text. */
const ltr=(s:string)=>'⁦'+s+'⁩';

const STATUS_ICON:Partial<Record<Status,IconName>>={completed:'check',needs_documents:'info',rejected:'close',cancelled:'close'};

type Props={
  lang:Lang;
  request:ClientRequest;
  onBack:()=>void;
  /** Receives the fresh server copy so the caller can store it (keeps local-only files). */
  onUpdated?:(r:ClientRequest)=>void;
  /** Lets the caller keep its own preview / download row for each file. */
  renderFile?:(f:ClientFile)=>React.ReactNode;
  /** Opens the missing-documents step when the team asked for more documents. */
  onMissing?:()=>void;
};

function useReduceTransparency(){
  // Opaque until the setting is known: never flash unreadable glass.
  const [reduce,setReduce]=useState(true);
  useEffect(()=>{
    let active=true,changed=false;
    const sub=AccessibilityInfo.addEventListener('reduceTransparencyChanged',v=>{changed=true;if(active)setReduce(v)});
    AccessibilityInfo.isReduceTransparencyEnabled().then(v=>{if(active&&!changed)setReduce(v)}).catch(()=>{if(active&&!changed)setReduce(false)});
    return()=>{active=false;sub.remove()};
  },[]);
  return reduce;
}

function GlassCard({children,reduce}:{children:React.ReactNode;reduce:boolean}){
  // The shadow sits on an outer View so the inner rounded clip keeps the blur.
  return <View style={styles.cardShadow}>
    <View style={styles.card}>
      {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={60}
        experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
      <View style={[styles.cardContent,reduce&&styles.opaque]}>{children}</View>
    </View>
  </View>;
}

function StatusBadge({lang,status}:{lang:Lang;status:Status}){
  const tone=statusTone(status),label=statusLabels[status][lang],row=lang==='ar'?'row-reverse':'row';
  return <View accessible accessibilityLabel={`${COPY[lang].status}: ${label}`}
    style={[styles.badge,{backgroundColor:tone.bg,flexDirection:row,alignSelf:lang==='ar'?'flex-end':'flex-start'}]}>
    <Icon name={STATUS_ICON[status]??'clock'} size={15} color={tone.fg}/>
    <Txt lang={lang} bold style={{...styles.badgeText,color:tone.fg}}>{label}</Txt>
  </View>;
}

function DetailRow({lang,label,value,last}:{lang:Lang;label:string;value:string;last?:boolean}){
  return <View style={[styles.detailRow,last&&styles.noBorder]}>
    <Txt lang={lang} style={styles.detailLabel}>{label}</Txt>
    <Txt lang={lang} bold style={styles.detailValue}>{value}</Txt>
  </View>;
}

type Sync={kind:'idle'}|{kind:'loading'}|{kind:'error';notFound:boolean};

export function TransactionDetailsScreen({lang,request,onBack,onUpdated,renderFile,onMissing}:Props){
  const t=COPY[lang],ar=lang==='ar',row=ar?'row-reverse':'row';
  const reduce=useReduceTransparency();
  const [tx,setTx]=useState(request);
  const [sync,setSync]=useState<Sync>({kind:'idle'});
  const [refreshing,setRefreshing]=useState(false);
  const [supportBusy,setSupportBusy]=useState(false);
  const [supportError,setSupportError]=useState(false);
  const mounted=useRef(true),supportLock=useRef(false),run=useRef(0);
  const onUpdatedRef=useRef(onUpdated);onUpdatedRef.current=onUpdated;
  const canFetch=!!request.remoteId&&!request.sample&&apiEnabled&&hasSession();

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  // Parent re-sync (e.g. the list refreshed) wins over what is on screen.
  useEffect(()=>{setTx(request)},[request]);

  // Android system back closes this screen.
  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true});return()=>sub.remove()},[onBack]);

  const load=useCallback(async(pull:boolean)=>{
    if(!canFetch||!request.remoteId)return;
    const id=++run.current;
    if(pull)setRefreshing(true);else setSync({kind:'loading'});
    try{
      const fresh=await fetchRequest(request.remoteId,request);
      if(!mounted.current||id!==run.current)return;
      setTx(fresh);setSync({kind:'idle'});onUpdatedRef.current?.(fresh);
    }catch(e){
      if(!mounted.current||id!==run.current)return;
      // 401 is handled by the api client (refresh, then session-expired handler).
      setSync({kind:'error',notFound:e instanceof ApiError&&e.status===404});
    }finally{if(mounted.current&&id===run.current)setRefreshing(false)}
  },[canFetch,request]);

  useEffect(()=>{void load(false)},[request.remoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reference=tx.id;
  async function contactSupport(){
    if(supportLock.current)return;
    supportLock.current=true;setSupportBusy(true);setSupportError(false);
    const ref=tx.remoteId&&tx.remoteId!==tx.id?`${tx.id} (${tx.remoteId})`:tx.id;
    try{
      // Opens WhatsApp with a prefilled message; nothing is sent automatically.
      try{await Linking.openURL(`${SUPPORT_WHATSAPP}?text=${encodeURIComponent(t.supportText(ref))}`)}
      catch{await Linking.openURL(SUPPORT_PHONE)}
    }catch{if(mounted.current)setSupportError(true)}
    finally{supportLock.current=false;if(mounted.current)setSupportBusy(false)}
  }

  const quoted=tx.finance?true:tx.money.quoted;
  const amount=tx.finance?tx.finance.totals.total:total(tx);
  const files=tx.files;

  return <View style={styles.screen}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.background}>
      <View style={[styles.orb,styles.orbWarm]}/>
      <View style={[styles.orb,styles.orbSand]}/>
    </View>

    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      refreshControl={canFetch?<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} tintColor={colors.orange} colors={[colors.orange]}/>:undefined}
      contentContainerStyle={styles.content}>
      <View style={styles.page}>
        <View style={[styles.header,{flexDirection:row}]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={onBack} style={styles.backButton}>
            <Icon name={ar?'next':'back'} size={24} color={colors.ink}/>
          </Pressable>
          <View style={styles.flex1}><Txt lang={lang} bold style={styles.headerTitle}>{t.title}</Txt></View>
        </View>

        {sync.kind==='loading'&&<View accessible accessibilityLabel={t.refreshing} accessibilityState={{busy:true}} style={[styles.notice,{flexDirection:row}]}>
          <ActivityIndicator color={colors.orange}/>
          <Txt lang={lang} style={styles.noticeText}>{t.refreshing}</Txt>
        </View>}
        {sync.kind==='error'&&<View style={[styles.notice,styles.noticeError,{flexDirection:row}]}>
          <Icon name="info" size={20} color={colors.danger}/>
          <View style={styles.flex1}><Txt lang={lang} style={{...styles.noticeText,color:colors.danger}}>{sync.notFound?t.notFound:t.offline}</Txt></View>
          {!sync.notFound&&<Pressable accessibilityRole="button" onPress={()=>void load(false)} style={styles.retry}>
            <Txt lang={lang} bold style={styles.retryText}>{t.retry}</Txt>
          </Pressable>}
        </View>}

        <GlassCard reduce={reduce}>
          <View style={[styles.titleSection,{alignItems:ar?'flex-end':'flex-start'}]}>
            <View style={styles.documentIcon}><Icon name="file" size={28} color={colors.orange}/></View>
            <Txt lang={lang} bold style={styles.transactionTitle}>{tx.title[lang]}</Txt>
            <Txt lang={lang} style={styles.reference}>{t.reference} {ltr('#'+reference)}</Txt>
            <StatusBadge lang={lang} status={tx.status}/>
          </View>

          {tx.whatNow&&<View style={[styles.whatNow,tx.whatNow.actionRequired&&styles.whatNowAction]}>
            <Txt lang={lang} bold style={styles.sectionLabel}>{t.whatNow}</Txt>
            <Txt lang={lang} style={styles.body}>{tx.whatNow[lang]}</Txt>
          </View>}

          <View style={styles.details}>
            <DetailRow lang={lang} label={t.submitted} value={dateText(tx.createdAt,lang)}/>
            <DetailRow lang={lang} label={t.updated} value={dateText(tx.updatedAt,lang)}/>
            <DetailRow lang={lang} label={t.expected} value={tx.expectedAt?dateText(tx.expectedAt,lang):t.toBeConfirmed}/>
            <DetailRow lang={lang} label={t.total} value={quoted?ltr(money(amount,lang)):t.notQuoted} last/>
          </View>

          {tx.status==='needs_documents'&&onMissing&&<Pressable accessibilityRole="button" onPress={onMissing} style={[styles.primaryButton,{flexDirection:row}]}>
            <Icon name="upload" size={20} color="#FFFFFF"/>
            <Txt lang={lang} bold style={styles.primaryButtonText}>{t.completeDocs}</Txt>
          </Pressable>}
        </GlassCard>

        {files.length>0&&<GlassCard reduce={reduce}>
          <Txt lang={lang} bold style={styles.sectionTitle}>{t.documents}</Txt>
          <View>
            {files.map((f,i)=>renderFile
              ?<React.Fragment key={f.id}>{renderFile(f)}</React.Fragment>
              :<View key={f.id} style={[styles.docRow,{flexDirection:row},i===files.length-1&&styles.noBorder]}>
                <Icon name={f.kind==='invoice'?'card':f.kind==='final'?'check':'file'} size={20} color={colors.orange}/>
                <View style={styles.flex1}>
                  <Txt lang={lang} bold style={styles.docName} numberOfLines={2}>{f.label[lang]}</Txt>
                  <Txt lang={lang} style={styles.meta}>{f.kind==='final'?t.final+' · ':f.kind==='invoice'?t.invoice+' · ':''}{dateText(f.createdAt,lang)}</Txt>
                </View>
              </View>)}
          </View>
        </GlassCard>}

        {tx.events.length>0&&<GlassCard reduce={reduce}>
          <Txt lang={lang} bold style={styles.sectionTitle}>{t.history}</Txt>
          <View>
            {tx.events.map((ev,i)=>{const last=i===tx.events.length-1;return <View key={ev.id} style={[styles.event,{flexDirection:row}]}>
              <View style={styles.eventRail}>
                <View style={[styles.eventDot,last&&{backgroundColor:colors.orange}]}/>
                {!last&&<View style={styles.eventLine}/>}
              </View>
              <View style={[styles.flex1,!last&&styles.eventGap]}>
                <Txt lang={lang} style={styles.body}>{ev.text[lang]}</Txt>
                <Txt lang={lang} style={styles.meta}>{dateText(ev.at,lang)}</Txt>
              </View>
            </View>})}
          </View>
        </GlassCard>}

        <View style={styles.supportBlock}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.contactSupportA11y} accessibilityState={{disabled:supportBusy,busy:supportBusy}}
            disabled={supportBusy} rippleColor="rgba(255,255,255,0.3)" onPress={()=>void contactSupport()}
            style={[styles.primaryButton,{flexDirection:row},supportBusy&&styles.disabled]}>
            {supportBusy?<ActivityIndicator color="#FFFFFF"/>:<Icon name="mail" size={20} color="#FFFFFF"/>}
            <Txt lang={lang} bold style={styles.primaryButtonText}>{supportBusy?t.opening:t.contactSupport}</Txt>
          </Pressable>
          {supportError&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={styles.errorText}>{t.supportError}</Txt></View>}
        </View>
      </View>
    </ScrollView>
  </View>;
}

const shadow=Platform.select({
  ios:{shadowColor:colors.brown,shadowOffset:{width:0,height:10},shadowOpacity:0.1,shadowRadius:22},
  android:{elevation:4},
  default:{},
}) as object;

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},
  background:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden'},
  orb:{position:'absolute',width:320,height:320,borderRadius:160},
  orbWarm:{backgroundColor:colors.gold,opacity:0.28,top:40,left:-130},
  orbSand:{backgroundColor:colors.brandTint,opacity:0.9,top:380,right:-150},
  content:{flexGrow:1,paddingHorizontal:space.xl,paddingTop:space.lg,paddingBottom:space.xxl+space.sm},
  page:{width:'100%',maxWidth:600,alignSelf:'center',gap:space.lg+2},
  flex1:{flex:1},

  header:{alignItems:'center',gap:space.md+2},
  backButton:{width:layout.minTouch+4,height:layout.minTouch+4,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border,overflow:'hidden'},
  headerTitle:{fontSize:type.title2,lineHeight:32},

  notice:{alignItems:'center',gap:space.sm,padding:space.md,borderRadius:radius.control,backgroundColor:colors.white},
  noticeError:{backgroundColor:'#FBE6E3'},
  noticeText:{fontSize:type.subhead,lineHeight:22,color:colors.muted},
  retry:{minHeight:layout.minTouch,justifyContent:'center',paddingHorizontal:space.md,borderRadius:radius.control,overflow:'hidden'},
  retryText:{fontSize:type.subhead,color:colors.brand},

  cardShadow:{borderRadius:radius.card+8,...shadow},
  card:{borderRadius:radius.card+8,overflow:'hidden',borderWidth:1,borderColor:onGlass.border},
  cardContent:{padding:space.xl+2,gap:space.lg+2,backgroundColor:Platform.select({ios:onGlass.field,default:'rgba(255,249,244,0.86)'})},
  opaque:{backgroundColor:colors.white},

  titleSection:{gap:space.sm},
  documentIcon:{width:58,height:58,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint,marginBottom:space.xs},
  transactionTitle:{fontSize:type.title2+2,lineHeight:36},
  reference:{fontSize:type.subhead,lineHeight:22,color:colors.muted},

  badge:{alignItems:'center',gap:6,borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:5},
  badgeText:{fontSize:type.footnote,lineHeight:20},

  whatNow:{gap:space.xs,padding:space.md,borderRadius:radius.control,backgroundColor:colors.white},
  whatNowAction:{backgroundColor:'#FFF0CE'},
  sectionLabel:{fontSize:type.footnote,lineHeight:20,color:colors.brand},
  body:{fontSize:type.subhead,lineHeight:24,color:onGlass.soft},

  details:{borderTopWidth:layout.hairline,borderTopColor:colors.line},
  detailRow:{gap:2,paddingVertical:13,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  noBorder:{borderBottomWidth:0},
  detailLabel:{fontSize:type.footnote,lineHeight:20,color:colors.muted},
  detailValue:{fontSize:type.callout,lineHeight:24},

  sectionTitle:{fontSize:type.callout,lineHeight:24},
  docRow:{alignItems:'center',gap:space.md,paddingVertical:space.md,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  docName:{fontSize:type.subhead,lineHeight:22},
  meta:{fontSize:type.caption+0.5,lineHeight:18,color:colors.muted},

  event:{gap:space.md},
  eventRail:{alignItems:'center',width:14},
  eventDot:{width:10,height:10,borderRadius:5,marginTop:9,backgroundColor:colors.line},
  eventLine:{flex:1,width:2,backgroundColor:colors.line,marginVertical:space.xs},
  eventGap:{paddingBottom:space.lg},

  supportBlock:{gap:space.sm+2},
  primaryButton:{minHeight:52,borderRadius:18,paddingHorizontal:18,paddingVertical:14,backgroundColor:colors.orange,flexWrap:'wrap',
    alignItems:'center',justifyContent:'center',gap:space.sm+2,overflow:'hidden'},
  primaryButtonText:{fontSize:type.subhead,color:'#FFFFFF',textAlign:'center',flexShrink:1},
  errorText:{fontSize:type.footnote+1,lineHeight:22,color:colors.danger,textAlign:'center'},
  disabled:{opacity:0.6},
});
