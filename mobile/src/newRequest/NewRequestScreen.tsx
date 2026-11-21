import React,{useMemo,useState} from 'react';
import {KeyboardAvoidingView,Platform,StyleSheet,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Entrance,GoldBadge,GoldText,LuxCard,ScalePressable} from '../ui/Premium';
import {GlassBackdrop,useReduceTransparency} from '../ui/Glass';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {ScrollView} from '../navigation/TabBarLayout';
import {colors,layout,lux,onGlass,radius,space,type} from '../theme';
import {SERVICES,type Service} from '../services';
import {CATEGORIES,branchesFor,serviceForBranch,type Category} from '../catalogue/categories';
import {structureFor,type ServiceAction} from '../serviceDetails';
import {toE164} from '../auth/phone';
import {SelectSheet,type SheetSection} from './SelectSheet';
import {pick,tr} from '../i18n';

type Lang=import('../i18n').Lang;
/** What the customer chose and typed here. It is handed to the ONE request flow (RequestWizard) and given back if they return. */
export type NewRequestChoice={mainKey:string;serviceId:string;actionId:string;name:string;phone:string;notes:string};
type Props={
  lang:Lang;account:{name:string;phone:string};
  /** previous choices and input, restored when the customer comes back from the next step */
  initial?:NewRequestChoice|null;
  /** continue into the same request flow used from a service page (documents, review, consent, submit) */
  onContinue:(choice:NewRequestChoice&{service:Service})=>void;onBack:()=>void;
};

const copy={
  ar:{title:'طلب جديد',sub:'اختر الخدمة وأكمل بياناتك لإنشاء معاملتك.',
    chooseGroup:'اختر خدمتك',main:'الخدمة الرئيسية',pickMain:'اختر الخدمة الرئيسية',service:'الخدمة الفرعية',pickService:'اختر الخدمة الفرعية',action:'نوع المعاملة',pickAction:'اختر نوع المعاملة',individuals:'خدمات الأفراد',companies:'خدمات الشركات',searchService:'ابحث عن خدمة',
    applicant:'بيانات مقدّم الطلب',name:'الاسم الكامل',namePh:'الاسم كما في الهوية',phone:'رقم الجوال',phonePh:'05XXXXXXXX',notes:'ملاحظات (اختياري)',notesPh:'أي تفاصيل تساعدنا في إنجاز معاملتك',
    docs:'المستندات المطلوبة',docsNote:'ترفع المستندات وتراجع طلبك في الخطوات التالية.',optional:'اختياري',noDocs:'لا مستندات إلزامية لهذه المعاملة.',
    next:'متابعة',create:'إنشاء الطلب',submit:'إرسال الطلب',creating:'جارٍ الإنشاء…',signIn:'سجّل الدخول لإنشاء الطلب',guestNote:'إنشاء الطلب وإرساله يحتاجان حساباً.',
    e_name:'أدخل اسمك الكامل.',e_phone:'أدخل رقم جوال إماراتي صحيحاً.',e_service:'اختر الخدمة الرئيسية والفرعية ونوع المعاملة.',
    e_net:'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',e_email:'أضف بريدك الإلكتروني من «حسابي» ثم أعد المحاولة.',e_many:'محاولات كثيرة. حاول لاحقاً.',e_gen:'تعذّر إنشاء الطلب. حاول مرة أخرى.',
    saveLocal:'حفظ كمسودة على هذا الجهاز',
    doneTitle:'تم إنشاء طلبك',doneSubmitted:'أُرسل طلبك وسيراجعه فريقنا.',doneDraft:'حُفظ طلبك كمسودة على الخادم. أرفق المستندات لإرساله.',ref:'رقم الطلب',
    uploadDocs:'رفع المستندات',toDashboard:'العودة إلى طلباتي',localOnly:'حُفظ على هذا الجهاز فقط ولم يصل الخادم بعد.'},
  en:{title:'New Request',sub:'Choose the service and complete your details to create your transaction.',
    chooseGroup:'Choose your service',main:'Main service',pickMain:'Choose the main service',service:'Branch',pickService:'Choose the branch',action:'Transaction type',pickAction:'Choose a transaction type',individuals:'Individual services',companies:'Business services',searchService:'Search for a service',
    applicant:'Applicant details',name:'Full name',namePh:'Name as on your ID',phone:'Mobile number',phonePh:'05XXXXXXXX',notes:'Notes (optional)',notesPh:'Anything that helps us complete your transaction',
    docs:'Required documents',docsNote:'You upload the documents and review your request in the next steps.',optional:'optional',noDocs:'No mandatory documents for this transaction.',
    next:'Continue',create:'Create Request',submit:'Submit Request',creating:'Creating…',signIn:'Sign in to create the request',guestNote:'Creating and submitting a request needs an account.',
    e_name:'Enter your full name.',e_phone:'Enter a valid UAE mobile number.',e_service:'Choose the main service, the branch and the transaction type.',
    e_net:'Could not reach the server. Check your internet and try again.',e_email:'Add your email in “My account” and try again.',e_many:'Too many attempts. Try again later.',e_gen:'Could not create the request. Try again.',
    saveLocal:'Save as a draft on this device',
    doneTitle:'Your request was created',doneSubmitted:'Your request was submitted and our team will review it.',doneDraft:'Your request is saved as a draft on the server. Attach the documents to submit it.',ref:'Request number',
    uploadDocs:'Upload documents',toDashboard:'Back to my requests',localOnly:'Saved on this device only; the server has not received it yet.'},
  ru:{title:'Новая заявка',sub:'Выберите услугу и заполните данные, чтобы создать заявку.',
    chooseGroup:'Выберите услугу',main:'Основная услуга',pickMain:'Выберите основную услугу',service:'Направление',pickService:'Выберите направление',action:'Тип операции',pickAction:'Выберите тип операции',individuals:'Услуги для частных лиц',companies:'Услуги для компаний',searchService:'Поиск услуги',
    applicant:'Данные заявителя',name:'Полное имя',namePh:'Как в удостоверении личности',phone:'Мобильный номер',phonePh:'05XXXXXXXX',notes:'Комментарий (необязательно)',notesPh:'Всё, что поможет нам выполнить заявку',
    docs:'Необходимые документы',docsNote:'Документы загружаются и заявка проверяется на следующих шагах.',optional:'необязательно',noDocs:'Для этой операции обязательные документы не нужны.',
    next:'Продолжить',create:'Создать заявку',submit:'Отправить заявку',creating:'Создаём…',signIn:'Войдите, чтобы создать заявку',guestNote:'Для создания и отправки заявки нужна учётная запись.',
    e_name:'Введите полное имя.',e_phone:'Введите действующий мобильный номер ОАЭ.',e_service:'Выберите основную услугу, направление и тип операции.',
    e_net:'Нет связи с сервером. Проверьте интернет и повторите попытку.',e_email:'Добавьте e-mail в «Мой профиль» и повторите попытку.',e_many:'Слишком много попыток. Повторите позже.',e_gen:'Не удалось создать заявку. Повторите попытку.',
    saveLocal:'Сохранить черновик на этом устройстве',
    doneTitle:'Заявка создана',doneSubmitted:'Заявка отправлена, наша команда её рассмотрит.',doneDraft:'Заявка сохранена как черновик на сервере. Приложите документы, чтобы отправить её.',ref:'Номер заявки',
    uploadDocs:'Загрузить документы',toDashboard:'К моим заявкам',localOnly:'Сохранено только на этом устройстве; сервер её ещё не получил.'},
  zh:{title:'新申请',sub:'选择服务并填写信息以创建您的申请。',
    chooseGroup:'选择服务',main:'主服务',pickMain:'选择主服务',service:'子服务',pickService:'选择子服务',action:'业务类型',pickAction:'选择业务类型',individuals:'个人服务',companies:'企业服务',searchService:'搜索服务',
    applicant:'申请人信息',name:'全名',namePh:'与身份证件一致',phone:'手机号码',phonePh:'05XXXXXXXX',notes:'备注（选填）',notesPh:'任何有助于我们办理的信息',
    docs:'所需文件',docsNote:'您将在后续步骤上传文件并核对申请。',optional:'选填',noDocs:'此业务无需必备文件。',
    next:'继续',create:'创建申请',submit:'提交申请',creating:'正在创建…',signIn:'登录后创建申请',guestNote:'创建和提交申请需要账户。',
    e_name:'请输入全名。',e_phone:'请输入有效的阿联酋手机号码。',e_service:'请选择主服务、子服务和业务类型。',
    e_net:'无法连接服务器，请检查网络后重试。',e_email:'请在“我的账户”中添加电子邮箱后重试。',e_many:'尝试次数过多，请稍后再试。',e_gen:'无法创建申请，请重试。',
    saveLocal:'在本设备保存为草稿',
    doneTitle:'申请已创建',doneSubmitted:'申请已提交，我们的团队将进行审核。',doneDraft:'申请已作为草稿保存在服务器上。上传文件后即可提交。',ref:'申请编号',
    uploadDocs:'上传文件',toDashboard:'返回我的申请',localOnly:'仅保存在本设备上，服务器尚未收到。'},
  fr:{title:'Nouvelle demande',sub:'Choisissez le service et complétez vos informations pour créer votre demande.',
    chooseGroup:'Choisissez votre service',main:'Service principal',pickMain:'Choisir le service principal',service:'Rubrique',pickService:'Choisir la rubrique',action:'Type de démarche',pickAction:'Choisir un type de démarche',individuals:'Services aux particuliers',companies:'Services aux entreprises',searchService:'Rechercher un service',
    applicant:'Informations du demandeur',name:'Nom complet',namePh:'Comme sur votre pièce d’identité',phone:'Numéro de mobile',phonePh:'05XXXXXXXX',notes:'Remarques (facultatif)',notesPh:'Tout ce qui peut nous aider à traiter votre demande',
    docs:'Documents requis',docsNote:'Vous téléversez les documents et vérifiez votre demande aux étapes suivantes.',optional:'facultatif',noDocs:'Aucun document obligatoire pour cette démarche.',
    next:'Continuer',create:'Créer la demande',submit:'Envoyer la demande',creating:'Création…',signIn:'Connectez-vous pour créer la demande',guestNote:'Un compte est nécessaire pour créer et envoyer une demande.',
    e_name:'Saisissez votre nom complet.',e_phone:'Saisissez un numéro de mobile émirien valide.',e_service:'Choisissez le service principal, la rubrique et le type de démarche.',
    e_net:'Serveur injoignable. Vérifiez votre connexion et réessayez.',e_email:'Ajoutez votre e-mail dans « Mon compte » puis réessayez.',e_many:'Trop de tentatives. Réessayez plus tard.',e_gen:'Impossible de créer la demande. Réessayez.',
    saveLocal:'Enregistrer comme brouillon sur cet appareil',
    doneTitle:'Votre demande a été créée',doneSubmitted:'Votre demande a été envoyée ; notre équipe va l’examiner.',doneDraft:'Votre demande est enregistrée comme brouillon sur le serveur. Joignez les documents pour l’envoyer.',ref:'Numéro de demande',
    uploadDocs:'Téléverser les documents',toDashboard:'Retour à mes demandes',localOnly:'Enregistrée sur cet appareil uniquement ; le serveur ne l’a pas encore reçue.'},
  es:{title:'Nueva solicitud',sub:'Elija el servicio y complete sus datos para crear su trámite.',
    chooseGroup:'Elija su servicio',main:'Servicio principal',pickMain:'Elegir el servicio principal',service:'Subservicio',pickService:'Elegir el subservicio',action:'Tipo de trámite',pickAction:'Elegir un tipo de trámite',individuals:'Servicios para particulares',companies:'Servicios para empresas',searchService:'Buscar un servicio',
    applicant:'Datos del solicitante',name:'Nombre completo',namePh:'Como figura en su documento',phone:'Número de móvil',phonePh:'05XXXXXXXX',notes:'Notas (opcional)',notesPh:'Cualquier dato que nos ayude a completar su trámite',
    docs:'Documentos necesarios',docsNote:'Subirá los documentos y revisará su solicitud en los siguientes pasos.',optional:'opcional',noDocs:'Este trámite no requiere documentos obligatorios.',
    next:'Continuar',create:'Crear solicitud',submit:'Enviar solicitud',creating:'Creando…',signIn:'Inicie sesión para crear la solicitud',guestNote:'Para crear y enviar una solicitud necesita una cuenta.',
    e_name:'Introduzca su nombre completo.',e_phone:'Introduzca un número de móvil válido de los EAU.',e_service:'Elija el servicio principal, el subservicio y el tipo de trámite.',
    e_net:'No se pudo conectar con el servidor. Compruebe su conexión e inténtelo de nuevo.',e_email:'Añada su correo en «Mi cuenta» e inténtelo de nuevo.',e_many:'Demasiados intentos. Inténtelo más tarde.',e_gen:'No se pudo crear la solicitud. Inténtelo de nuevo.',
    saveLocal:'Guardar como borrador en este dispositivo',
    doneTitle:'Su solicitud se ha creado',doneSubmitted:'Su solicitud se ha enviado y nuestro equipo la revisará.',doneDraft:'Su solicitud está guardada como borrador en el servidor. Adjunte los documentos para enviarla.',ref:'Número de solicitud',
    uploadDocs:'Subir documentos',toDashboard:'Volver a mis solicitudes',localOnly:'Guardada solo en este dispositivo; el servidor aún no la ha recibido.'},
} as const;

/** Create a clearance request: service + type pickers, applicant details, one primary action; the server stores it (POST /v1/requests) before we confirm. */
export function NewRequestScreen({lang,account,initial,onContinue,onBack}:Props){
  const t=pick(copy,lang),ar=lang==='ar';
  // restore what the customer chose/typed before (coming back from the next step loses nothing)
  const init=useMemo(()=>{
    if(!initial)return null;
    const [aud,cid]=initial.mainKey.split(':');const category=CATEGORIES.find(c=>c.id===cid);const svc=SERVICES.find(x=>x.id===initial.serviceId)??null;
    const act=svc?structureFor(svc.id).actions.find(a=>a.id===initial.actionId)??null:null;
    return category?{main:{category,business:aud==='c'},service:svc,action:act}:null;
  },[]); // eslint-disable-line react-hooks/exhaustive-deps
  const [service,setService]=useState<Service|null>(init?.service??null);
  const [action,setAction]=useState<ServiceAction|null>(init?.action??null);
  const [name,setName]=useState(initial?.name??account.name);const [phone,setPhone]=useState(initial?.phone??account.phone);const [notes,setNotes]=useState(initial?.notes??'');
  const [main,setMain]=useState<{category:Category;business:boolean}|null>(init?.main??null);
  const [sheet,setSheet]=useState<null|'main'|'service'|'action'>(null);
  const [touched,setTouched]=useState(false);

  const structure=service?structureFor(service.id):null;
  const required=action?action.documents.filter(d=>!d.optional):[];
  // Step 1: the unified main services, once per audience; step 2: its branches; step 3: the transaction type.
  const mainSections=useMemo<SheetSection[]>(()=>([false,true] as const).map(business=>({title:business?t.companies:t.individuals,
    items:CATEGORIES.filter(c=>branchesFor(c,business).length).map(c=>({id:`${business?'c':'i'}:${c.id}`,title:tr(c.title,lang),
      subtitle:branchesFor(c,business).length>1?branchesFor(c,business).map(b=>tr(b.title,lang)).join(' · '):tr(c.desc,lang)}))})),[lang,t]);
  const branches=main?branchesFor(main.category,main.business):[];
  const sections=useMemo<SheetSection[]>(()=>[{items:branches.map(b=>({id:b.serviceId,title:tr(b.title,lang),subtitle:tr(b.desc,lang)}))}],[branches,lang]);
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
  const branchTitle=service?tr(branches.find(b=>b.serviceId===service.id)?.title,lang):'';
  const actionSections=useMemo<SheetSection[]>(()=>[{items:(structure?.actions??[]).map(a=>({id:a.id,title:tr(a,lang)}))}],[structure,lang]);

  const errors={service:!service||!action?t.e_service:'',name:name.trim().length<2?t.e_name:'',phone:!toE164(phone)?t.e_phone:''};
  const valid=!errors.service&&!errors.name&&!errors.phone;

  const submit=()=>{
    setTouched(true);
    if(!valid||!service||!action||!main)return;
    onContinue({service,mainKey:`${main.business?'c':'i'}:${main.category.id}`,serviceId:service.id,actionId:action.id,name:name.trim(),phone:toE164(phone)!,notes:notes.trim()});
  };

  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
    <GlassBackdrop/>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <Entrance index={0} style={s.titleBlock}>
        <GoldText lang={lang} style={s.largeTitle}>{t.title}</GoldText>
        <Txt lang={lang} style={s.sub}>{t.sub}</Txt>
      </Entrance>

      <Group lang={lang} title={t.chooseGroup} index={1}>
        <PickerRow lang={lang} label={t.main} value={main?tr(main.category.title,lang)+' — '+(main.business?t.companies:t.individuals):''} placeholder={t.pickMain} onPress={()=>setSheet('main')} last={!main}/>
        {main&&branches.length>1?<PickerRow lang={lang} label={t.service} value={branchTitle} placeholder={t.pickService} onPress={()=>setSheet('service')} last={!service}/>:null}
        {service?<PickerRow lang={lang} label={t.action} value={action?tr(action,lang):''} placeholder={t.pickAction} onPress={()=>setSheet('action')} last/>:null}
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
            <Txt lang={lang} style={s.docLine}>{tr(d,lang)}{d.optional&&!/if applicable|حسب الحالة|إن وجد/i.test(tr(d,lang))?` (${t.optional})`:''}</Txt>
          </View>)}
          <Txt lang={lang} style={s.docNote}>{t.docsNote}</Txt>
        </View>
      </Group>:null}

      <ScalePressable accessibilityRole="button" accessibilityLabel={t.next} onPress={submit}
        rippleColor="rgba(14,21,38,0.18)" style={[s.primary,!valid&&s.primaryDim]}>
        <LinearGradient pointerEvents="none" colors={lux.orange} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <View pointerEvents="none"><Txt lang={lang} style={s.primaryText}>{t.next}</Txt></View>
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
