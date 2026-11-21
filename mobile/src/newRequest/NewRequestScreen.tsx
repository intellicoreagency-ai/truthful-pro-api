import React,{useMemo,useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,StyleSheet,TextInput,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {ScrollView} from '../navigation/TabBarLayout';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {SERVICES,serviceDescription,serviceLabel,type Service} from '../services';
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
    chooseGroup:'اختر خدمتك',service:'الخدمة',pickService:'اختر الخدمة',action:'نوع المعاملة',pickAction:'اختر نوع المعاملة',individuals:'خدمات الأفراد',companies:'خدمات الشركات',searchService:'ابحث عن خدمة',
    applicant:'بيانات مقدّم الطلب',name:'الاسم الكامل',namePh:'الاسم كما في الهوية',phone:'رقم الجوال',phonePh:'05XXXXXXXX',notes:'ملاحظات (اختياري)',notesPh:'أي تفاصيل تساعدنا في إنجاز معاملتك',
    docs:'المستندات المطلوبة',docsNote:'ترفع المستندات في الخطوة التالية بعد إنشاء الطلب.',optional:'اختياري',noDocs:'لا مستندات إلزامية لهذه المعاملة.',
    create:'إنشاء الطلب',submit:'إرسال الطلب',creating:'جارٍ الإنشاء…',signIn:'سجّل الدخول لإنشاء الطلب',guestNote:'إنشاء الطلب وإرساله يحتاجان حساباً.',
    e_name:'أدخل اسمك الكامل.',e_phone:'أدخل رقم جوال إماراتي صحيحاً.',e_service:'اختر الخدمة ونوع المعاملة.',
    e_net:'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',e_email:'أضف بريدك الإلكتروني من «حسابي» ثم أعد المحاولة.',e_many:'محاولات كثيرة. حاول لاحقاً.',e_gen:'تعذّر إنشاء الطلب. حاول مرة أخرى.',
    saveLocal:'حفظ كمسودة على هذا الجهاز',
    doneTitle:'تم إنشاء طلبك',doneSubmitted:'أُرسل طلبك وسيراجعه فريقنا.',doneDraft:'حُفظ طلبك كمسودة على الخادم. أرفق المستندات لإرساله.',ref:'رقم الطلب',
    uploadDocs:'رفع المستندات',toDashboard:'العودة إلى طلباتي',localOnly:'حُفظ على هذا الجهاز فقط ولم يصل الخادم بعد.'},
  en:{title:'New Request',sub:'Choose the service and complete your details to create your transaction.',
    chooseGroup:'Choose your service',service:'Service',pickService:'Choose a service',action:'Transaction type',pickAction:'Choose a transaction type',individuals:'Individual services',companies:'Business services',searchService:'Search for a service',
    applicant:'Applicant details',name:'Full name',namePh:'Name as on your ID',phone:'Mobile number',phonePh:'05XXXXXXXX',notes:'Notes (optional)',notesPh:'Anything that helps us complete your transaction',
    docs:'Required documents',docsNote:'You upload the documents in the next step, after the request is created.',optional:'optional',noDocs:'No mandatory documents for this transaction.',
    create:'Create Request',submit:'Submit Request',creating:'Creating…',signIn:'Sign in to create the request',guestNote:'Creating and submitting a request needs an account.',
    e_name:'Enter your full name.',e_phone:'Enter a valid UAE mobile number.',e_service:'Choose the service and the transaction type.',
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
  const [sheet,setSheet]=useState<null|'service'|'action'>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [canLocal,setCanLocal]=useState(false);
  const [done,setDone]=useState<CreatedInfo|null>(null);
  const [touched,setTouched]=useState(false);

  const structure=service?structureFor(service.id):null;
  const required=action?action.documents.filter(d=>!d.optional):[];
  const sections=useMemo<SheetSection[]>(()=>[
    {title:t.individuals,items:SERVICES.filter(x=>!x.business).map(x=>({id:x.id,title:serviceLabel(x,lang),subtitle:serviceDescription(x,lang)}))},
    {title:t.companies,items:SERVICES.filter(x=>x.business).map(x=>({id:x.id,title:serviceLabel(x,lang),subtitle:serviceDescription(x,lang)}))},
  ],[lang,t]);
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
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <Txt lang={lang} style={s.largeTitle}>{t.title}</Txt>
      <Txt lang={lang} style={s.sub}>{t.sub}</Txt>

      <Group lang={lang} title={t.chooseGroup}>
        <PickerRow lang={lang} label={t.service} value={service?serviceLabel(service,lang):''} placeholder={t.pickService} onPress={()=>setSheet('service')} last={!service}/>
        {service?<PickerRow lang={lang} label={t.action} value={action?action[lang]:''} placeholder={t.pickAction} onPress={()=>setSheet('action')} last/>:null}
      </Group>
      {touched&&errors.service?<Err lang={lang}>{errors.service}</Err>:null}

      <Group lang={lang} title={t.applicant}>
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

      {action?<Group lang={lang} title={t.docs}>
        <View style={s.docs}>
          {action.documents.length===0?<Txt lang={lang} style={s.docLine}>{t.noDocs}</Txt>:action.documents.map(d=><View key={d.id} style={[s.docRow,{flexDirection:ar?'row-reverse':'row'}]}>
            <Icon name={d.optional?'info':'file'} size={18} color={d.optional?colors.muted:colors.brand}/>
            <Txt lang={lang} style={s.docLine}>{d[lang]}{d.optional?` (${t.optional})`:''}</Txt>
          </View>)}
          <Txt lang={lang} style={s.docNote}>{t.docsNote}</Txt>
        </View>
      </Group>:null}

      {error?<View style={s.errorBox} accessibilityLiveRegion="polite"><Txt lang={lang} style={s.errorText}>{error}</Txt>
        {canLocal?<ScalePressable accessibilityRole="button" onPress={()=>{onSaved(build());onBack();}} style={s.errorLink}><Txt lang={lang} style={s.errorLinkText}>{t.saveLocal}</Txt></ScalePressable>:null}
      </View>:null}
      {!signedIn?<Txt lang={lang} style={s.guest}>{t.guestNote}</Txt>:null}

      <ScalePressable accessibilityRole="button" accessibilityLabel={signedIn?(required.length||!action?t.create:t.submit):t.signIn} accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>void submit()}
        rippleColor="rgba(48,37,31,0.18)" style={[s.primary,(!valid&&signedIn)&&s.primaryDim]}>
        {busy?<View style={s.busyRow}><ActivityIndicator color={colors.ink}/><Txt lang={lang} style={s.primaryText}>{t.creating}</Txt></View>
          :<Txt lang={lang} style={s.primaryText}>{signedIn?(required.length||!action?t.create:t.submit):t.signIn}</Txt>}
      </ScalePressable>
    </ScrollView>

    <SelectSheet visible={sheet==='service'} lang={lang} title={t.pickService} sections={sections} selectedId={service?.id} searchPlaceholder={t.searchService}
      onSelect={id=>{const next=SERVICES.find(x=>x.id===id)!;if(next.id!==service?.id){setService(next);setAction(null);}setSheet(structureFor(id).actions.length>1?'action':null);if(structureFor(id).actions.length===1)setAction(structureFor(id).actions[0]);}}
      onClose={()=>setSheet(null)}/>
    <SelectSheet visible={sheet==='action'} lang={lang} title={t.pickAction} sections={actionSections} selectedId={action?.id}
      onSelect={id=>{setAction(structure?.actions.find(a=>a.id===id)??null);setSheet(null);}} onClose={()=>setSheet(null)}/>
  </KeyboardAvoidingView>;
}

function Group({lang,title,children}:{lang:Lang;title:string;children:React.ReactNode}){
  return <View style={s.groupWrap}><Txt lang={lang} style={s.groupTitle}>{title}</Txt><View style={s.group}>{children}</View></View>;
}
function PickerRow({lang,label,value,placeholder,onPress,last}:{lang:Lang;label:string;value:string;placeholder:string;onPress:()=>void;last?:boolean}){
  const ar=lang==='ar';
  return <ScalePressable accessibilityRole="button" accessibilityLabel={`${label}: ${value||placeholder}`} onPress={onPress} style={[s.pickRow,{flexDirection:ar?'row-reverse':'row'},!last&&s.rowLine]}>
    <View style={s.pickText}><Txt lang={lang} style={s.label}>{label}</Txt><Txt lang={lang} style={[s.pickValue,!value&&{color:onGlass.placeholder}]} numberOfLines={2}>{value||placeholder}</Txt></View>
    <Icon name={ar?'back':'next'} size={18} color={colors.muted}/>
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
  return <ScrollView contentContainerStyle={s.doneWrap} showsVerticalScrollIndicator={false}>
    <View style={s.doneIcon}><Icon name="check" size={40} color="#2D681F"/></View>
    <Txt lang={lang} style={s.doneTitle}>{t.doneTitle}</Txt>
    <Txt lang={lang} style={s.doneBody}>{info.onServer?(info.submitted?t.doneSubmitted:t.doneDraft):t.localOnly}</Txt>
    <View style={s.refBox}><Txt lang={lang} style={s.refLabel}>{t.ref}</Txt><Txt lang="en" style={s.refValue}>{'⁦#'+ref+'⁩'}</Txt></View>
    {!info.submitted?<ScalePressable accessibilityRole="button" accessibilityLabel={t.uploadDocs} onPress={onUpload} rippleColor="rgba(48,37,31,0.18)" style={s.primary}><Txt lang={lang} style={s.primaryText}>{t.uploadDocs}</Txt></ScalePressable>:null}
    <ScalePressable accessibilityRole="button" accessibilityLabel={t.toDashboard} onPress={onDashboard} style={s.secondary}><Txt lang={lang} style={s.secondaryText}>{t.toDashboard}</Txt></ScalePressable>
  </ScrollView>;
}

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:colors.background},
  scroll:{paddingHorizontal:space.lg,paddingTop:space.lg,paddingBottom:space.xxl,gap:space.lg},
  largeTitle:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.25,fontWeight:'800'},
  sub:{fontSize:type.body,lineHeight:type.body*1.5,color:colors.muted,marginTop:-space.sm},
  groupWrap:{gap:space.sm},groupTitle:{fontSize:type.footnote,fontWeight:'700',color:colors.muted,paddingHorizontal:space.xs},
  group:{backgroundColor:colors.white,borderRadius:radius.card-6,borderWidth:layout.hairline,borderColor:colors.line,overflow:'hidden'},
  rowLine:{borderBottomWidth:layout.hairline,borderColor:colors.line},
  pickRow:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+14,paddingHorizontal:space.lg,paddingVertical:space.md},
  pickText:{flex:1,gap:2},pickValue:{fontSize:type.body,fontWeight:'600'},
  label:{fontSize:type.footnote,color:colors.muted,fontWeight:'600'},
  field:{paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.xs,gap:2},
  input:{minHeight:layout.minTouch,fontSize:type.body,color:colors.ink,paddingVertical:space.xs,...Platform.select({web:{outlineStyle:'none'} as object,default:{}})},
  inputTall:{minHeight:88,textAlignVertical:'top'},
  fieldError:{fontSize:type.footnote,color:onGlass.error,fontWeight:'600',paddingBottom:space.sm,paddingHorizontal:space.xs},
  docs:{padding:space.lg,gap:space.sm},docRow:{alignItems:'center',gap:space.md},docLine:{flex:1,fontSize:type.callout,lineHeight:type.callout*1.45},
  docNote:{fontSize:type.footnote,color:colors.muted,marginTop:space.xs},
  errorBox:{backgroundColor:'#FBE6E3',borderRadius:14,padding:space.md,gap:space.xs},errorText:{fontSize:type.subhead,color:onGlass.error,fontWeight:'600'},
  errorLink:{minHeight:layout.minTouch-8,justifyContent:'center'},errorLinkText:{fontSize:type.subhead,color:colors.brand,fontWeight:'700',textDecorationLine:'underline'},
  guest:{fontSize:type.footnote,color:colors.muted,textAlign:'center'},
  primary:{minHeight:54,borderRadius:16,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl,marginTop:space.sm,
    ...Platform.select({ios:{shadowColor:'#FF8A00',shadowOffset:{width:0,height:6},shadowOpacity:0.3,shadowRadius:12},android:{elevation:4},default:{boxShadow:'0 6px 14px rgba(255,138,0,0.3)'} as object})},
  primaryDim:{opacity:0.6},
  primaryText:{fontSize:type.headline,fontWeight:'700',color:colors.ink,textAlign:'center'},
  busyRow:{flexDirection:'row',alignItems:'center',gap:space.md},
  secondary:{minHeight:52,borderRadius:16,backgroundColor:colors.brandTint,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xl},
  secondaryText:{fontSize:type.headline,fontWeight:'600',color:colors.brand,textAlign:'center'},
  doneWrap:{flexGrow:1,justifyContent:'center',alignItems:'stretch',padding:space.xl,gap:space.lg},
  doneIcon:{alignSelf:'center',width:88,height:88,borderRadius:44,backgroundColor:'#E5F2D9',alignItems:'center',justifyContent:'center'},
  doneTitle:{fontSize:type.title,fontWeight:'800',textAlign:'center'},doneBody:{fontSize:type.body,lineHeight:type.body*1.5,color:colors.muted,textAlign:'center'},
  refBox:{alignItems:'center',gap:2,paddingVertical:space.md,borderRadius:16,backgroundColor:colors.white,borderWidth:layout.hairline,borderColor:colors.line},
  refLabel:{fontSize:type.footnote,color:colors.muted},refValue:{fontSize:type.title2,fontWeight:'700',letterSpacing:1},
});
