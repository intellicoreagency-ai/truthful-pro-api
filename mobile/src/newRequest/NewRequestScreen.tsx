import React,{useMemo,useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,StyleSheet,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Entrance,GoldBadge,GoldText,LuxCard,ScalePressable} from '../ui/Premium';
import {GlassBackdrop,useReduceTransparency} from '../ui/Glass';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {ScrollView} from '../navigation/TabBarLayout';
import {colors,layout,lux,onGlass,radius,space,type} from '../theme';
import {type Service} from '../services';
import {CATEGORIES,branchesFor,serviceForBranch,type Category} from '../catalogue/categories';
import {structureFor,type ServiceAction} from '../serviceDetails';
import {makeId,type ClientRequest} from '../clientModel';
import {ApiError,createRemoteRequest,submitRemoteRequest} from '../api';
import {toE164} from '../auth/phone';
import {SelectSheet,type SheetSection} from './SelectSheet';

type Lang='ar'|'en';
export type CreatedInfo={record:ClientRequest;submitted:boolean;onServer:boolean};
type Props={
  lang:Lang;account:{name:string;phone:string};signedIn:boolean;
  /** called as soon as the record exists (server-stored or local): the app keeps it in its list */
  onSaved:(record:ClientRequest)=>void;onOpenDocuments:(record:ClientRequest)=>void;onBack:()=>void;onSignIn:()=>void;
};

const copy={
  ar:{title:'طلب جديد',sub:'اختر الخدمة وأكمل بياناتك لإنشاء معاملتك.',
    chooseGroup:'اختر خدمتك',main:'الخدمة الرئيسية',pickMain:'اختر الخدمة الرئيسية',service:'الخدمة الفرعية',pickService:'اختر الخدمة الفرعية',action:'نوع المعاملة',pickAction:'اختر نوع المعاملة',individuals:'خدمات الأفراد',companies:'خدمات الشركات',searchService:'ابحث عن خدمة',
    applicant:'بيانات مقدّم الطلب',name:'الاسم الكامل',namePh:'الاسم كما في الهوية',phone:'رقم الجوال',phonePh:'05XXXXXXXX',notes:'ملاحظات (اختياري)',notesPh:'أي تفاصيل تساعدنا في إنجاز معاملتك',
    docs:'المستندات المطلوبة',docsNote:'ترفع المستندات في الخطوة التالية بعد إنشاء الطلب.',optional:'اختياري',noDocs:'لا مستندات إلزامية لهذه المعاملة.',
    create:'إنشاء الطلب',submit:'إرسال الطلب',creating:'جارٍ الإنشاء…',signIn:'سجّل الدخول لإنشاء الطلب',guestNote:'إنشاء الطلب وإرساله يحتاجان حساباً.',
    e_name:'أدخل اسمك الكامل.',e_phone:'أدخل رقم جوال إماراتي صحيحاً.',e_service:'اختر الخدمة الرئيسية والفرعية ونوع المعاملة.',
    e_net:'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',e_email:'أضف بريدك الإلكتروني من «حسابي» ثم أعد المحاولة.',e_many:'محاولات كثيرة. حاول لاحقاً.',e_gen:'تعذّر إنشاء الطلب. حاول مرة أخرى.',
    saveLocal:'حفظ كمسودة على هذا الجهاز',
    doneTitle:'تم إنشاء طلبك',doneSubmitted:'أُرسل طلبك وسيراجعه فريقنا.',doneDraft:'حُفظ طلبك كمسودة على الخادم. أرفق المستندات لإرساله.',ref:'رقم الطلب',
    uploadDocs:'رفع المستندات',toDashboard:'العودة إلى طلباتي',localOnly:'حُفظ على هذا الجهاز فقط ولم يصل الخادم بعد.'},
  en:{title:'New Request',sub:'Choose the service and complete your details to create your transaction.',
    chooseGroup:'Choose your service',main:'Main service',pickMain:'Choose the main service',service:'Branch',pickService:'Choose the branch',action:'Transaction type',pickAction:'Choose a transaction type',individuals:'Individual services',companies:'Business services',searchService:'Search for a service',
    applicant:'Applicant details',name:'Full name',namePh:'Name as on your ID',phone:'Mobile number',phonePh:'05XXXXXXXX',notes:'Notes (optional)',notesPh:'Anything that helps us complete your transaction',
    docs:'Required documents',docsNote:'You upload the documents in the next step, after the request is created.',optional:'optional',noDocs:'No mandatory documents for this transaction.',
    create:'Create Request',submit:'Submit Request',creating:'Creating…',signIn:'Sign in to create the request',guestNote:'Creating and submitting a request needs an account.',
    e_name:'Enter your full name.',e_phone:'Enter a valid UAE mobile number.',e_service:'Choose the main service, the branch and the transaction type.',
    e_net:'Could not reach the server. Check your internet and try again.',e_email:'Add your email in “My account” and try again.',e_many:'Too many attempts. Try again later.',e_gen:'Could not create the request. Try again.',
    saveLocal:'Save as a draft on this device',
    doneTitle:'Your request was created',doneSubmitted:'Your request was submitted and our team will review it.',doneDraft:'Your request is saved as a draft on the server. Attach the documents to submit it.',ref:'Request number',
    uploadDocs:'Upload documents',toDashboard:'Back to my requests',localOnly:'Saved on this device only; the server has not received it yet.'},
} as const;

/** Create a clearance request: service + type pickers, applicant details, one primary action; the server stores it (POST /v1/requests) before we confirm. */
export function NewRequestScreen({lang,account,signedIn,onSaved,onOpenDocuments,onBack,onSignIn}:Props){
  const t=copy[lang],ar=lang==='ar';
  const [service,setService]=useState<Service|null>(null);
  const [action,setAction]=useState<ServiceAction|null>(null);
  const [name,setName]=useState(account.name);const [phone,setPhone]=useState(account.phone);const [notes,setNotes]=useState('');
  const [main,setMain]=useState<{category:Category;business:boolean}|null>(null);
  const [sheet,setSheet]=useState<null|'main'|'service'|'action'>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [canLocal,setCanLocal]=useState(false);
  const [done,setDone]=useState<CreatedInfo|null>(null);
  const [touched,setTouched]=useState(false);

  const structure=service?structureFor(service.id):null;
  const required=action?action.documents.filter(d=>!d.optional):[];
  // Step 1: the unified main services, once per audience; step 2: its branches; step 3: the transaction type.
  const mainSections=useMemo<SheetSection[]>(()=>([false,true] as const).map(business=>({title:business?t.companies:t.individuals,
    items:CATEGORIES.filter(c=>branchesFor(c,business).length).map(c=>({id:`${business?'c':'i'}:${c.id}`,title:c.title[lang],
      subtitle:branchesFor(c,business).length>1?branchesFor(c,business).map(b=>b.title[lang]).join(' · '):c.desc[lang]}))})),[lang,t]);
  const branches=main?branchesFor(main.category,main.business):[];
  const sections=useMemo<SheetSection[]>(()=>[{items:branches.map(b=>({id:b.serviceId,title:b.title[lang],subtitle:b.desc[lang]}))}],[branches,lang]);
  const pickService=(next:Service)=>{
    if(next.id!==service?.id){setService(next);setAction(null);}
    const actions=structureFor(next.id).actions;
    if(actions.length===1){setAction(actions[0]!);setSheet(null);}else setSheet('action');
  };
  const pickMain=(id:string)=>{
    const [aud,cid]=id.split(':');const category=CATEGORIES.find(c=>c.id===cid)!;const business=aud==='c';
    if(category.id!==main?.category.id||business!==main?.business){setMain({category,business});setService(null);setAction(null);}
    const list=branchesFor(category,business);
    if(list.length===1){const svc=serviceForBranch(list[0]!);if(svc)pickService(svc);else setSheet(null);}else setSheet('service');
  };
  const branchTitle=service?branches.find(b=>b.serviceId===service.id)?.title[lang]??'':'';
  const actionSections=useMemo<SheetSection[]>(()=>[{items:(structure?.actions??[]).map(a=>({id:a.id,title:a[lang]}))}],[structure,lang]);

  const errors={service:!service||!action?t.e_service:'',name:name.trim().length<2?t.e_name:'',phone:!toE164(phone)?t.e_phone:''};
  const valid=!errors.service&&!errors.name&&!errors.phone;

  const build=():ClientRequest=>{
    const now=new Date().toISOString();
    return {id:makeId(),serviceId:service!.id,actionId:action!.id,title:{ar:action!.ar,en:action!.en},createdAt:now,updatedAt:now,status:'draft',stage:1,name:name.trim(),phone:toE164(phone)!,
      fields:notes.trim()?{notes:notes.trim()}:{},files:[],missing:[],events:[],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false}};
  };
  const submit=async()=>{
    setTouched(true);setError('');setCanLocal(false);
    if(!valid)return;
    if(!signedIn){onSignIn();return;}
    const record=build();const noRequiredDocs=required.length===0;
    setBusy(true);
    try{
      const created=await createRemoteRequest(record);          // the server stores it and gives its id
      let status:ClientRequest['status']='draft';
      if(noRequiredDocs){await submitRemoteRequest(created.id);status='submitted';}
      const saved:ClientRequest={...record,status,remoteId:created.id,syncedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      onSaved(saved);
      setDone({record:saved,submitted:status==='submitted',onServer:true});
    }catch(e){
      const c=e instanceof ApiError?e.code:'';
      setError(c==='email_required'?t.e_email:c==='too_many_requests'?t.e_many:c==='network'?t.e_net:t.e_gen);
      setCanLocal(c==='network');
    }finally{setBusy(false);}
  };

  if(done)return <Done lang={lang} info={done} onUpload={()=>onOpenDocuments(done.record)} onDashboard={onBack}/>;

  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
    <GlassBackdrop/>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <Entrance index={0} style={s.titleBlock}>
        <GoldText lang={lang} style={s.largeTitle}>{t.title}</GoldText>
        <Txt lang={lang} style={s.sub}>{t.sub}</Txt>
      </Entrance>

      <Group lang={lang} title={t.chooseGroup} index={1}>
        <PickerRow lang={lang} label={t.main} value={main?main.category.title[lang]+' — '+(main.business?t.companies:t.individuals):''} placeholder={t.pickMain} onPress={()=>setSheet('main')} last={!main}/>
        {main&&branches.length>1?<PickerRow lang={lang} label={t.service} value={branchTitle} placeholder={t.pickService} onPress={()=>setSheet('service')} last={!service}/>:null}
        {service?<PickerRow lang={lang} label={t.action} value={action?action[lang]:''} placeholder={t.pickAction} onPress={()=>setSheet('action')} last/>:null}
      </Group>
      {touched&&errors.service?<Err lang={lang}>{errors.service}</Err>:null}

      <Group lang={lang} title={t.applicant} index={2}>
        <Field lang={lang} label={t.name} last={false} error={touched?errors.name:''}>
          <Input lang={lang} value={name} onChangeText={setName} placeholder={t.namePh} autoComplete="name" textContentType="name" maxLength={80}/>
        </Field>
        <Field lang={lang} label={t.phone} last={false} error={touched?errors.phone:''}>
          <Input lang={lang} value={phone} onChangeText={setPhone} placeholder={t.phonePh} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={16} ltr/>
        </Field>
        <Field lang={lang} label={t.notes} last error="">
          <Input lang={lang} value={notes} onChangeText={setNotes} placeholder={t.notesPh} multiline maxLength={500} tall/>
        </Field>
      </Group>

      {action?<Group lang={lang} title={t.docs} index={3}>
        <View style={s.docs}>
          {action.documents.length===0?<Txt lang={lang} style={s.docLine}>{t.noDocs}</Txt>:action.documents.map(d=><View key={d.id} style={[s.docRow,{flexDirection:ar?'row-reverse':'row'}]}>
            {d.optional?<View style={s.optionalDot}><Icon name="info" size={16} color={colors.muted}/></View>:<GoldBadge icon="file" size={30}/>}
            <Txt lang={lang} style={s.docLine}>{d[lang]}{d.optional&&!/if applicable|حسب الحالة|إن وجد/i.test(d[lang])?` (${t.optional})`:''}</Txt>
          </View>)}
          <Txt lang={lang} style={s.docNote}>{t.docsNote}</Txt>
        </View>
      </Group>:null}

      {error?<View style={s.errorBox} accessibilityLiveRegion="polite"><Txt lang={lang} style={s.errorText}>{error}</Txt>
        {canLocal?<ScalePressable accessibilityRole="button" onPress={()=>{onSaved(build());onBack();}} style={s.errorLink}><Txt lang={lang} style={s.errorLinkText}>{t.saveLocal}</Txt></ScalePressable>:null}
      </View>:null}
      {!signedIn?<Txt lang={lang} style={s.guest}>{t.guestNote}</Txt>:null}

      <ScalePressable accessibilityRole="button" accessibilityLabel={signedIn?(required.length||!action?t.create:t.submit):t.signIn} accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>void submit()}
        rippleColor="rgba(14,21,38,0.18)" style={[s.primary,(!valid&&signedIn)&&s.primaryDim]}>
        <LinearGradient pointerEvents="none" colors={lux.orange} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <View pointerEvents="none">{busy?<View style={s.busyRow}><ActivityIndicator color={lux.onAction}/><Txt lang={lang} style={s.primaryText}>{t.creating}</Txt></View>
          :<Txt lang={lang} style={s.primaryText}>{signedIn?(required.length||!action?t.create:t.submit):t.signIn}</Txt>}</View>
      </ScalePressable>
    </ScrollView>

    <SelectSheet visible={sheet==='main'} lang={lang} title={t.pickMain} sections={mainSections} selectedId={main?`${main.business?'c':'i'}:${main.category.id}`:null} searchPlaceholder={t.searchService}
      onSelect={pickMain} onClose={()=>setSheet(null)}/>
    <SelectSheet visible={sheet==='service'} lang={lang} title={t.pickService} sections={sections} selectedId={service?.id}
      onSelect={id=>{const br=branches.find(b=>b.serviceId===id);const svc=br&&serviceForBranch(br);if(svc)pickService(svc);}}
      onClose={()=>setSheet(null)}/>
    <SelectSheet visible={sheet==='action'} lang={lang} title={t.pickAction} sections={actionSections} selectedId={action?.id}
      onSelect={id=>{setAction(structure?.actions.find(a=>a.id===id)??null);setSheet(null);}} onClose={()=>setSheet(null)}/>
  </KeyboardAvoidingView>;
}

function Group({lang,title,children,index=0}:{lang:Lang;title:string;children:React.ReactNode;index?:number}){
  const reduce=useReduceTransparency();
  return <Entrance index={index} style={s.groupWrap}>
    <View accessibilityRole="header"><Txt lang={lang} bold style={s.groupTitle}>{title}</Txt></View>
    <LuxCard reduce={reduce} radius={radius.card}>{children}</LuxCard>
  </Entrance>;
}
function PickerRow({lang,label,value,placeholder,onPress,last}:{lang:Lang;label:string;value:string;placeholder:string;onPress:()=>void;last?:boolean}){
  const ar=lang==='ar';
  return <ScalePressable accessibilityRole="button" accessibilityLabel={`${label}: ${value||placeholder}`} onPress={onPress} style={[s.pickRow,{flexDirection:ar?'row-reverse':'row'},!last&&s.rowLine]}>
    <View style={s.pickText}><Txt lang={lang} style={s.label}>{label}</Txt><Txt lang={lang} style={[s.pickValue,!value&&{color:onGlass.placeholder}]} numberOfLines={2}>{value||placeholder}</Txt></View>
    <View pointerEvents="none"><GoldBadge icon={ar?'back':'next'} size={30}/></View>
  </ScalePressable>;
}
function Field({lang,label,error,last,children}:{lang:Lang;label:string;error?:string;last?:boolean;children:React.ReactNode}){
  return <View style={[s.field,!last&&s.rowLine]}><Txt lang={lang} style={s.label}>{label}</Txt>{children}{error?<Txt lang={lang} style={s.fieldError}>{error}</Txt>:null}</View>;
}
function Input({lang,ltr,tall,...p}:{lang:Lang;ltr?:boolean;tall?:boolean}&React.ComponentProps<typeof TextInput>){
  const ar=lang==='ar';
  return <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" placeholderTextColor={onGlass.placeholder} selectionColor={colors.brand}
    {...p} style={[s.input,tall&&s.inputTall,ar?{fontFamily:'CairoRegular'}:null,{textAlign:ar?'right':'left',writingDirection:ltr?'ltr':ar?'rtl':'ltr'}]}/>;
}
function Err({lang,children}:{lang:Lang;children:React.ReactNode}){return <Txt lang={lang} style={s.fieldError}>{children}</Txt>}

function Done({lang,info,onUpload,onDashboard}:{lang:Lang;info:CreatedInfo;onUpload:()=>void;onDashboard:()=>void}){
  const t=copy[lang];
  const ref=(info.record.remoteId??info.record.id).slice(0,8).toUpperCase();
  const reduce=useReduceTransparency();
  return <View style={s.fill}><GlassBackdrop/><ScrollView contentContainerStyle={s.doneWrap} showsVerticalScrollIndicator={false}>
    <Entrance index={0} style={s.doneHead}>
      <GoldBadge icon="check" size={96}/>
      <GoldText lang={lang} style={s.doneTitle}>{t.doneTitle}</GoldText>
      <Txt lang={lang} style={s.doneBody}>{info.onServer?(info.submitted?t.doneSubmitted:t.doneDraft):t.localOnly}</Txt>
    </Entrance>
    <Entrance index={1}><LuxCard reduce={reduce} contentStyle={s.refBox}><Txt lang={lang} style={s.refLabel}>{t.ref}</Txt><Txt lang="en" style={s.refValue}>{'\u2066#'+ref+'\u2069'}</Txt></LuxCard></Entrance>
    <Entrance index={2} style={s.doneActions}>
      {!info.submitted?<ScalePressable accessibilityRole="button" accessibilityLabel={t.uploadDocs} onPress={onUpload} rippleColor="rgba(14,21,38,0.18)" style={s.primary}>
        <LinearGradient pointerEvents="none" colors={lux.orange} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <View pointerEvents="none"><Txt lang={lang} style={s.primaryText}>{t.uploadDocs}</Txt></View>
      </ScalePressable>:null}
      <ScalePressable accessibilityRole="button" accessibilityLabel={t.toDashboard} onPress={onDashboard} style={s.secondary}><Txt lang={lang} style={s.secondaryText}>{t.toDashboard}</Txt></ScalePressable>
    </Entrance>
  </ScrollView></View>;
}

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:lux.ivory},
  scroll:{paddingHorizontal:space.lg,paddingTop:space.lg,paddingBottom:space.xxl,gap:space.lg,width:'100%',maxWidth:600,alignSelf:'center'},
  titleBlock:{gap:space.xs},
  largeTitle:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.25},
  sub:{fontSize:type.body,lineHeight:type.body*1.5,color:colors.muted},
  groupWrap:{gap:space.sm},groupTitle:{fontSize:type.subhead,color:colors.brand,paddingHorizontal:space.xs},
  rowLine:{borderBottomWidth:1,borderColor:'rgba(217,188,126,0.3)'},
  optionalDot:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(91,100,117,0.1)'},
  pickRow:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+14,paddingHorizontal:space.lg,paddingVertical:space.md},
  pickText:{flex:1,gap:2},pickValue:{fontSize:type.body,fontWeight:'600'},
  label:{fontSize:type.footnote,color:colors.muted,fontWeight:'600'},
  field:{paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.md,gap:2},
  input:{minHeight:layout.minTouch,fontSize:type.body,color:colors.ink,paddingVertical:space.xs,paddingHorizontal:space.md,marginTop:space.xs,borderRadius:radius.control,borderWidth:1,borderColor:'rgba(217,188,126,0.45)',backgroundColor:'rgba(255,255,255,0.6)',...Platform.select({web:{outlineStyle:'none'} as object,default:{}})},
  inputTall:{minHeight:88,textAlignVertical:'top'},
  fieldError:{fontSize:type.footnote,color:onGlass.error,fontWeight:'600',paddingBottom:space.sm,paddingHorizontal:space.xs},
  docs:{padding:space.lg,gap:space.sm},docRow:{alignItems:'center',gap:space.md},docLine:{flex:1,fontSize:type.callout,lineHeight:type.callout*1.45},
  docNote:{fontSize:type.footnote,color:colors.muted,marginTop:space.xs},
  errorBox:{backgroundColor:'#FBE6E3',borderRadius:16,padding:space.md,gap:space.xs,borderWidth:1,borderColor:'rgba(163,38,26,0.25)'},errorText:{fontSize:type.subhead,color:onGlass.error,fontWeight:'600'},
  errorLink:{minHeight:layout.minTouch-8,justifyContent:'center'},errorLinkText:{fontSize:type.subhead,color:colors.brand,fontWeight:'700',textDecorationLine:'underline'},
  guest:{fontSize:type.footnote,color:colors.muted,textAlign:'center'},
  primary:{minHeight:56,borderRadius:18,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl,marginTop:space.sm,overflow:'hidden',
    ...Platform.select({ios:{shadowColor:'#1D3A9E',shadowOffset:{width:0,height:8},shadowOpacity:0.3,shadowRadius:14},android:{elevation:4},default:{boxShadow:'0 8px 16px rgba(29,58,158,0.28)'} as object})},
  primaryDim:{opacity:0.6},
  primaryText:{fontSize:type.headline,fontWeight:'700',color:lux.onAction,textAlign:'center'},
  busyRow:{flexDirection:'row',alignItems:'center',gap:space.md},
  secondary:{minHeight:54,borderRadius:18,backgroundColor:'rgba(255,255,255,0.9)',borderWidth:1,borderColor:'rgba(217,188,126,0.6)',alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl},
  secondaryText:{fontSize:type.headline,fontWeight:'600',color:colors.brand,textAlign:'center'},
  doneWrap:{flexGrow:1,justifyContent:'center',alignItems:'stretch',padding:space.xl,gap:space.lg,width:'100%',maxWidth:600,alignSelf:'center'},
  doneHead:{alignItems:'center',gap:space.md},
  doneActions:{gap:space.md},
  doneTitle:{fontSize:type.title,lineHeight:type.title*1.3,textAlign:'center'},doneBody:{fontSize:type.body,lineHeight:type.body*1.5,color:colors.muted,textAlign:'center'},
  refBox:{alignItems:'center',gap:2,paddingVertical:space.lg},
  refLabel:{fontSize:type.footnote,color:colors.muted},refValue:{fontSize:type.title2,fontWeight:'700',letterSpacing:1},
});
