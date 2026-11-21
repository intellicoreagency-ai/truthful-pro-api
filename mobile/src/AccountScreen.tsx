/**
 * My Account — glass redesign. Overview (photo, identity, shortcuts, settings list) and sections:
 * personal, company, saved documents, favourites, notifications, security & privacy, language.
 * Fixed: notifications showed 0 even when a request needed action; Saved documents could not be opened;
 * an invalid email was stored silently; delete confirmation now looks destructive.
 */
import React,{useEffect,useRef,useState} from 'react';
import {BackHandler,Image,StyleSheet,View} from 'react-native';
import {ScalePressable} from './ui/Premium';
import {Icon,type IconName} from './Icons';
import {officialLogo} from './ReferenceUI';
import {Txt} from './ui/Txt';
import {GlassButton,GlassCard,GlassField,GlassScreen,Note,ScreenHeader,g,rowFor,useReduceTransparency} from './ui/Glass';
import {ScrollView} from './navigation/TabBarLayout';
import {colors,layout,radius,space,type} from './theme';
import {chooseAccountPhoto,type AccountData} from './accountStorage';
import {LANGS,LANG_INFO,pick} from './i18n';

type Language=import('./i18n').Lang;
type Section='personal'|'company'|'documents'|'notifications'|'security'|'language'|'favorites';
type Field='name'|'email'|'phone'|'company'|'license';
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const ui={
  ar:{
    title:'حسابي',guest:'ضيف',member:'عميل',individual:'عميل أفراد',business:'عميل شركات',local:'حساب محلي للمعاينة',linked:'حساب مرتبط',
    person:'بياناتي الشخصية',personHint:'عرض وتحديث بياناتك ومعلومات التواصل',
    company:'بيانات الشركة',companyHint:'إدارة معلومات شركتك',
    docs:'المستندات المحفوظة',docsHint:'الملفات المرفقة بمسوداتك في هذه الجلسة',
    notifications:'الإشعارات',notificationsHint:'تنبيهات حالة الطلبات والتحديثات',
    security:'الأمان والخصوصية',securityHint:'الشروط والخصوصية وبياناتك',
    language:'اللغة',requests:'طلباتي',favorites:'المفضلة',exit:'الخروج من صفحة الحساب',back:'رجوع إلى حسابي',
    addPhoto:'إضافة صورة شخصية',changePhoto:'تغيير الصورة الشخصية',removePhoto:'إزالة الصورة الشخصية',
    photoSize:'حجم الصورة يتجاوز ٢ ميغابايت. اختر صورة أصغر.',photoFormat:'اختر صورة بصيغة JPG أو PNG أو WebP.',
    photoError:'تعذّر فتح الصورة. جرّب صورة أخرى.',storageError:'تعذّر الحفظ على هذا الجهاز.',
    save:'حفظ',saved:'تم الحفظ على هذا الجهاز.',emptyDocs:'لا توجد مستندات مرفقة في هذه الجلسة.',
    emptyNotifications:'لا توجد إشعارات جديدة.',emptyFavorites:'لم تضف أي خدمة إلى المفضلة.',openRequests:'فتح طلباتي',
    browse:'تصفّح الخدمات',settings:'إعدادات الحساب',
    privacy:'تُحفظ صورة الحساب وبياناته على هذا الجهاز. تسجيل الدخول والتحقق من الهوية غير متاحين في المعاينة.',
    terms:'شروط الاستخدام',policy:'سياسة الخصوصية',exportData:'تصدير بياناتي',deleteAccount:'حذف حسابي',deleteWarn:'سيُحذف حسابك وطلباتك ومستنداتك نهائياً ولا يمكن التراجع.',deleteConfirm:'نعم، احذف كل شيء',cancel:'إلغاء',signOut:'تسجيل الخروج',working:'جارٍ التنفيذ…',exported:'تم تجهيز نسخة من بياناتك.',failed:'تعذّر التنفيذ. تحقق من الاتصال وحاول مجدداً.',signedInNote:'حسابك مرتبط بالخادم. لك حق الاطلاع على بياناتك وتصحيحها وحذفها.',
    name:'الاسم الكامل',email:'البريد الإلكتروني',phone:'رقم الهاتف',companyName:'اسم الشركة',license:'رقم الرخصة',
    emailInvalid:'أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com.',emailSent:'أرسلنا رسالة ترحيب إلى بريدك، يرجى تأكيده.',emailServerError:'تعذر حفظ البريد على الخادم.',
    selected:'محددة',
  },
  en:{
    title:'My Account',guest:'Guest',member:'Client',individual:'Individual client',business:'Company client',local:'Local preview profile',linked:'Linked account',
    person:'Personal Information',personHint:'View and update your contact details',
    company:'Company Information',companyHint:'Manage your company details',
    docs:'Saved Documents',docsHint:'Files attached to drafts in this session',
    notifications:'Notifications',notificationsHint:'Request updates and alerts',
    security:'Security & Privacy',securityHint:'Terms, privacy and your data',
    language:'Language',requests:'My Requests',favorites:'Favorites',exit:'Leave Account',back:'Back to My Account',
    addPhoto:'Add profile photo',changePhoto:'Change profile photo',removePhoto:'Remove profile photo',
    photoSize:'Choose a photo under 2 MB.',photoFormat:'Choose a JPG, PNG or WebP image.',
    photoError:'Could not open the photo. Try a different image.',storageError:'Could not save to this device.',
    save:'Save',saved:'Saved on this device.',emptyDocs:'No documents attached in this session.',
    emptyNotifications:'No new notifications.',emptyFavorites:'You haven’t added any favorite services.',openRequests:'Open My Requests',
    browse:'Browse Services',settings:'Account Settings',
    privacy:'Your profile and photo are stored on this device. Sign-in and identity verification are unavailable in this preview.',
    terms:'Terms of Use',policy:'Privacy Policy',exportData:'Export my data',deleteAccount:'Delete my account',deleteWarn:'Your account, requests and documents will be permanently deleted. This cannot be undone.',deleteConfirm:'Yes, delete everything',cancel:'Cancel',signOut:'Sign out',working:'Working…',exported:'A copy of your data is ready.',failed:'Could not complete. Check your connection and try again.',signedInNote:'Your account is linked to our server. You can access, correct and delete your data.',
    name:'Full name',email:'Email address',phone:'Phone number',companyName:'Company name',license:'Trade licence number',
    emailInvalid:'Enter a valid email address, like name@example.com.',emailSent:'We sent a welcome email: please confirm your address.',emailServerError:'Could not save the email on the server.',
    selected:'selected',
  },
  ru:{
    title:'Мой профиль',guest:'Гость',member:'Клиент',individual:'Частный клиент',business:'Корпоративный клиент',local:'Локальный профиль',linked:'Аккаунт подключён',
    person:'Личные данные',personHint:'Просмотр и изменение контактов',
    company:'Данные компании',companyHint:'Управление данными компании',
    docs:'Сохранённые документы',docsHint:'Файлы черновиков этой сессии',
    notifications:'Уведомления',notificationsHint:'Обновления по заявкам',
    security:'Безопасность и конфиденциальность',securityHint:'Условия, конфиденциальность и ваши данные',
    language:'Язык',requests:'Мои заявки',favorites:'Избранное',exit:'Выйти из профиля',back:'Назад в профиль',
    addPhoto:'Добавить фото',changePhoto:'Сменить фото',removePhoto:'Удалить фото',
    photoSize:'Выберите фото до 2 МБ.',photoFormat:'Выберите изображение JPG, PNG или WebP.',
    photoError:'Не удалось открыть фото. Попробуйте другое изображение.',storageError:'Не удалось сохранить на этом устройстве.',
    save:'Сохранить',saved:'Сохранено на этом устройстве.',emptyDocs:'В этой сессии документов нет.',
    emptyNotifications:'Новых уведомлений нет.',emptyFavorites:'Вы ещё не добавили услуги в избранное.',openRequests:'Открыть мои заявки',
    browse:'Перейти к услугам',settings:'Настройки аккаунта',
    privacy:'Профиль и фото хранятся на этом устройстве. Вход и проверка личности недоступны в этом режиме.',
    terms:'Условия',policy:'Конфиденциальность',exportData:'Выгрузить мои данные',deleteAccount:'Удалить аккаунт',deleteWarn:'Аккаунт, заявки и документы будут удалены навсегда. Это действие нельзя отменить.',deleteConfirm:'Да, удалить всё',cancel:'Отмена',signOut:'Выйти',working:'Выполняется…',exported:'Копия ваших данных готова.',failed:'Не удалось выполнить. Проверьте соединение и повторите.',signedInNote:'Ваш аккаунт связан с нашим сервером. Вы можете просматривать, исправлять и удалять свои данные.',
    name:'Полное имя',email:'Эл. почта',phone:'Телефон',companyName:'Название компании',license:'Номер торговой лицензии',
    emailInvalid:'Введите корректный адрес, например name@example.com.',emailSent:'Мы отправили приветственное письмо — подтвердите адрес.',emailServerError:'Не удалось сохранить e-mail на сервере.',
    selected:'выбрано',
  },
  zh:{
    title:'我的账户',guest:'访客',member:'客户',individual:'个人客户',business:'企业客户',local:'本地预览资料',linked:'已关联账户',
    person:'个人信息',personHint:'查看并更新联系方式',
    company:'公司信息',companyHint:'管理公司信息',
    docs:'已保存文件',docsHint:'本次会话草稿中的文件',
    notifications:'通知',notificationsHint:'申请更新与提醒',
    security:'安全与隐私',securityHint:'条款、隐私及您的数据',
    language:'语言',requests:'我的申请',favorites:'收藏',exit:'退出账户',back:'返回我的账户',
    addPhoto:'添加头像',changePhoto:'更换头像',removePhoto:'删除头像',
    photoSize:'请选择小于 2 MB 的照片。',photoFormat:'请选择 JPG、PNG 或 WebP 图片。',
    photoError:'无法打开照片，请换一张图片。',storageError:'无法保存到本设备。',
    save:'保存',saved:'已保存到本设备。',emptyDocs:'本次会话没有附加文件。',
    emptyNotifications:'暂无新通知。',emptyFavorites:'您还没有收藏任何服务。',openRequests:'打开我的申请',
    browse:'浏览服务',settings:'账户设置',
    privacy:'您的资料和照片保存在本设备上。本预览不提供登录和身份验证。',
    terms:'使用条款',policy:'隐私政策',exportData:'导出我的数据',deleteAccount:'删除我的账户',deleteWarn:'您的账户、申请和文件将被永久删除，且无法恢复。',deleteConfirm:'是，全部删除',cancel:'取消',signOut:'退出登录',working:'处理中…',exported:'您的数据副本已准备好。',failed:'未能完成，请检查网络后重试。',signedInNote:'您的账户已与我们的服务器关联。您可以查看、更正和删除您的数据。',
    name:'全名',email:'电子邮箱',phone:'电话',companyName:'公司名称',license:'营业执照编号',
    emailInvalid:'请输入有效邮箱，例如 name@example.com。',emailSent:'我们已发送欢迎邮件，请确认您的邮箱。',emailServerError:'无法在服务器上保存邮箱。',
    selected:'已选择',
  },
  fr:{
    title:'Mon compte',guest:'Invité',member:'Client',individual:'Client particulier',business:'Client entreprise',local:'Profil local',linked:'Compte lié',
    person:'Informations personnelles',personHint:'Consulter et modifier vos coordonnées',
    company:'Informations de la société',companyHint:'Gérer les informations de votre société',
    docs:'Documents enregistrés',docsHint:'Fichiers joints aux brouillons de cette session',
    notifications:'Notifications',notificationsHint:'Mises à jour et alertes',
    security:'Sécurité et confidentialité',securityHint:'Conditions, confidentialité et données',
    language:'Langue',requests:'Mes demandes',favorites:'Favoris',exit:'Quitter le compte',back:'Retour à mon compte',
    addPhoto:'Ajouter une photo',changePhoto:'Changer la photo',removePhoto:'Supprimer la photo',
    photoSize:'Choisissez une photo de moins de 2 Mo.',photoFormat:'Choisissez une image JPG, PNG ou WebP.',
    photoError:'Impossible d’ouvrir la photo. Essayez une autre image.',storageError:'Enregistrement impossible sur cet appareil.',
    save:'Enregistrer',saved:'Enregistré sur cet appareil.',emptyDocs:'Aucun document joint dans cette session.',
    emptyNotifications:'Aucune nouvelle notification.',emptyFavorites:'Vous n’avez encore aucun service favori.',openRequests:'Ouvrir mes demandes',
    browse:'Voir les services',settings:'Paramètres du compte',
    privacy:'Votre profil et votre photo sont stockés sur cet appareil. Connexion et vérification d’identité indisponibles dans cet aperçu.',
    terms:'Conditions',policy:'Confidentialité',exportData:'Exporter mes données',deleteAccount:'Supprimer mon compte',deleteWarn:'Votre compte, vos demandes et vos documents seront définitivement supprimés. Action irréversible.',deleteConfirm:'Oui, tout supprimer',cancel:'Annuler',signOut:'Se déconnecter',working:'En cours…',exported:'Une copie de vos données est prête.',failed:'Échec. Vérifiez votre connexion et réessayez.',signedInNote:'Votre compte est relié à notre serveur. Vous pouvez consulter, corriger et supprimer vos données.',
    name:'Nom complet',email:'Adresse e-mail',phone:'Téléphone',companyName:'Nom de la société',license:'N° de licence commerciale',
    emailInvalid:'Saisissez une adresse valide, par ex. name@example.com.',emailSent:'Nous avons envoyé un e-mail de bienvenue : confirmez votre adresse.',emailServerError:'Impossible d’enregistrer l’e-mail sur le serveur.',
    selected:'sélectionné',
  },
  es:{
    title:'Mi cuenta',guest:'Invitado',member:'Cliente',individual:'Cliente particular',business:'Cliente empresa',local:'Perfil local',linked:'Cuenta vinculada',
    person:'Datos personales',personHint:'Ver y actualizar sus datos de contacto',
    company:'Datos de la empresa',companyHint:'Gestionar los datos de su empresa',
    docs:'Documentos guardados',docsHint:'Archivos adjuntos a borradores de esta sesión',
    notifications:'Notificaciones',notificationsHint:'Novedades y avisos de solicitudes',
    security:'Seguridad y privacidad',securityHint:'Términos, privacidad y sus datos',
    language:'Idioma',requests:'Mis solicitudes',favorites:'Favoritos',exit:'Salir de la cuenta',back:'Volver a mi cuenta',
    addPhoto:'Añadir foto',changePhoto:'Cambiar foto',removePhoto:'Quitar foto',
    photoSize:'Elija una foto de menos de 2 MB.',photoFormat:'Elija una imagen JPG, PNG o WebP.',
    photoError:'No se pudo abrir la foto. Pruebe con otra imagen.',storageError:'No se pudo guardar en este dispositivo.',
    save:'Guardar',saved:'Guardado en este dispositivo.',emptyDocs:'No hay documentos adjuntos en esta sesión.',
    emptyNotifications:'No hay notificaciones nuevas.',emptyFavorites:'Aún no ha añadido servicios favoritos.',openRequests:'Abrir mis solicitudes',
    browse:'Ver servicios',settings:'Ajustes de la cuenta',
    privacy:'Su perfil y su foto se guardan en este dispositivo. El inicio de sesión y la verificación no están disponibles en esta vista previa.',
    terms:'Términos',policy:'Privacidad',exportData:'Exportar mis datos',deleteAccount:'Eliminar mi cuenta',deleteWarn:'Su cuenta, solicitudes y documentos se eliminarán de forma permanente. No se puede deshacer.',deleteConfirm:'Sí, eliminar todo',cancel:'Cancelar',signOut:'Cerrar sesión',working:'Procesando…',exported:'Una copia de sus datos está lista.',failed:'No se pudo completar. Compruebe la conexión e inténtelo de nuevo.',signedInNote:'Su cuenta está vinculada a nuestro servidor. Puede consultar, corregir y eliminar sus datos.',
    name:'Nombre completo',email:'Correo electrónico',phone:'Teléfono',companyName:'Nombre de la empresa',license:'N.º de licencia comercial',
    emailInvalid:'Introduzca un correo válido, como name@example.com.',emailSent:'Le enviamos un correo de bienvenida: confirme su dirección.',emailServerError:'No se pudo guardar el correo en el servidor.',
    selected:'seleccionado',
  },
};

type Props={
  lang:Language;account:AccountData;update:(data:Partial<AccountData>)=>boolean;requests:number;
  documents:{key:string;name:string}[];favorites:{id:string;label:string}[];
  /** Requests that need something from the customer (shown as notifications). */
  alerts:{id:string;title:string;note:string}[];
  onFavorite:(id:string)=>void;onRequests:()=>void;onBrowse:()=>void;onLanguage:(lang:Language)=>void;onLeave:()=>void;
  signedIn:boolean;onLegal:(kind:'terms'|'privacy')=>void;onExport:()=>Promise<boolean>;onDelete:()=>Promise<boolean>;onSignOut:()=>Promise<void>;
  onEmail?:(email:string)=>Promise<void>;
};

export function AccountScreen({lang,account,update,requests,documents,favorites,alerts,onFavorite,onRequests,onBrowse,onLanguage,onLeave,signedIn,onLegal,onExport,onDelete,onSignOut,onEmail}:Props){
  const ar=lang==='ar',row=rowFor(lang),forward:IconName=ar?'back':'next';
  const t=pick(ui,lang);
  const reduce=useReduceTransparency();
  const [section,setSection]=useState<Section|null>(null);
  const [edits,setEdits]=useState<Partial<Record<Field,string>>>({});
  const [message,setMessage]=useState('');
  const [photoMessage,setPhotoMessage]=useState('');
  const [photoFailed,setPhotoFailed]=useState(false);
  const [privacyMsg,setPrivacyMsg]=useState('');
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [working,setWorking]=useState(false);
  const run=async(f:()=>Promise<boolean|void>,ok?:string)=>{setWorking(true);setPrivacyMsg(t.working);try{const r=await f();setPrivacyMsg(r===false?t.failed:ok??'')}catch{setPrivacyMsg(t.failed)}finally{setWorking(false);setConfirmDelete(false)}};
  const scroll=useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pickerPending=useRef(false);

  const open=(next:Section|null)=>{setEdits({});setMessage('');setSection(next);scroll.current?.scrollTo({y:0,animated:false})};
  useEffect(()=>{
    if(!section)return;
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{open(null);return true});
    return ()=>sub.remove();
  },[section]);
  const pickPhoto=async()=>{
    if(pickerPending.current)return;
    pickerPending.current=true;setPhotoMessage('');
    try{
      const photo=await chooseAccountPhoto();
      if(photo){if(update({photo})){setPhotoFailed(false);setPhotoMessage(t.saved)}else setPhotoMessage(t.storageError)}
    }catch(error){
      const reason=error instanceof Error?error.message:'';
      setPhotoMessage(reason==='format'?t.photoFormat:reason==='size'?t.photoSize:t.photoError);
    }finally{pickerPending.current=false}
  };
  const sections:Record<Section,{title:string;description:string;icon:IconName}>={
    personal:{title:t.person,description:t.personHint,icon:'user'},
    company:{title:t.company,description:t.companyHint,icon:'places'},
    documents:{title:t.docs,description:t.docsHint,icon:'folder'},
    notifications:{title:t.notifications,description:t.notificationsHint,icon:'bell'},
    security:{title:t.security,description:t.securityHint,icon:'shield'},
    language:{title:t.language,description:LANG_INFO[lang].native,icon:'globe'},
    favorites:{title:t.favorites,description:'',icon:'star'},
  };
  const fields:readonly [Field,string][]=section==='company'?[['company',t.companyName],['license',t.license]]:[['name',t.name],['email',t.email],['phone',t.phone]];
  const saveFields=()=>{
    const mail=(edits.email??'').trim();
    if(edits.email!==undefined&&mail&&!EMAIL.test(mail)){setMessage(t.emailInvalid);return}
    const ok=update(edits);setMessage(ok?t.saved:t.storageError);
    if(ok&&signedIn&&onEmail&&mail)void onEmail(mail).then(()=>setMessage(t.emailSent)).catch(()=>setMessage(t.emailServerError));
  };
  const shortcut=(label:string,value:number,icon:IconName,onPress:()=>void,alert=false)=>
    <ScalePressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} style={[styles.shortcut,alert&&styles.shortcutAlert]}>
      <Icon name={icon} size={22} color={alert?'#76592A':colors.brand}/>
      <Txt lang={lang} bold style={styles.count}>{String(value)}</Txt>
      <Txt lang={lang} style={styles.shortcutName}>{label}</Txt>
    </ScalePressable>;
  const menuRow=(key:Section,last:boolean)=>{const item=sections[key];const badge=key==='notifications'&&alerts.length>0;
    return <ScalePressable key={key} onPress={()=>open(key)} accessibilityRole="button" accessibilityLabel={item.title+(badge?`, ${alerts.length}`:'')}
      style={[styles.menuItem,{flexDirection:row},last&&g.noBorder]}>
      <View style={styles.menuIcon}><Icon name={item.icon} size={20} color={colors.brand}/></View>
      <View style={g.flex1}><Txt lang={lang} bold style={styles.label}>{item.title}</Txt><Txt lang={lang} style={g.meta}>{item.description}</Txt></View>
      {badge&&<View style={styles.badgeCount}><Txt lang={lang} bold style={styles.badgeCountText}>{String(alerts.length)}</Txt></View>}
      <Icon name={forward} size={16} color={colors.muted}/>
    </ScalePressable>};
  const menu=['personal','company','documents','notifications','security','language'] as const;

  return <GlassScreen scrollRef={scroll}>
    <ScreenHeader lang={lang} title={section?sections[section].title:t.title} backLabel={t.back} onBack={section?()=>open(null):undefined}
      trailing={!section?<Image source={officialLogo} style={styles.logo} accessible={false}/>:undefined}/>

    {!section?<>
      <GlassCard reduce={reduce}>
        <View style={[styles.identity,{flexDirection:row}]}>
          <ScalePressable accessibilityRole="button" accessibilityLabel={account.photo?t.changePhoto:t.addPhoto} style={styles.avatarButton} onPress={pickPhoto}>
            <View style={styles.avatar}>
              {account.photo&&!photoFailed?<Image key={account.photo} source={{uri:account.photo}} style={styles.photo}
                onError={()=>{setPhotoFailed(true);setPhotoMessage(t.photoError)}} accessible={false}/>:<Icon name="user" size={34} color={colors.brand}/>}
            </View>
            <View style={styles.camera}><Icon name="camera" size={16} color="#FFFFFF"/></View>
          </ScalePressable>
          <View style={[g.flex1,styles.identityText]}>
            <Txt lang={lang} bold style={styles.name} numberOfLines={2}>{account.name||(signedIn?t.member:t.guest)}</Txt>
            <Txt lang={lang} style={g.meta}>{account.company?t.business:t.individual}</Txt>
            <View style={[styles.pill,{flexDirection:row,alignSelf:ar?'flex-end':'flex-start'}]}>
              <Icon name="shield" size={13} color={colors.brand}/>
              <Txt lang={lang} bold style={styles.pillText}>{signedIn?t.linked:t.local}</Txt>
            </View>
          </View>
        </View>
        {!!photoMessage&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={g.meta}>{photoMessage}</Txt></View>}
      </GlassCard>

      <View style={[styles.shortcuts,{flexDirection:row}]}>
        {shortcut(t.favorites,favorites.length,'star',()=>open('favorites'))}
        {shortcut(t.requests,requests,'file',onRequests)}
        {shortcut(t.notifications,alerts.length,'bell',()=>open('notifications'),alerts.length>0)}
      </View>

      <GlassCard reduce={reduce}>
        <View>{menu.map((key,i)=>menuRow(key,i===menu.length-1))}</View>
      </GlassCard>

      <ScalePressable accessibilityRole="button" onPress={onLeave} style={[styles.exit,{flexDirection:row}]}>
        <Icon name="power" size={19} color={colors.danger}/><Txt lang={lang} bold style={styles.exitText}>{t.exit}</Txt>
      </ScalePressable>
    </>:<GlassCard reduce={reduce}>
      {(section==='personal'||section==='company')&&<>
        {fields.map(([key,label])=><GlassField key={key} lang={lang} label={label} value={edits[key]??account[key]}
          onChangeText={value=>setEdits(previous=>({...previous,[key]:value}))} autoCapitalize={key==='email'?'none':'sentences'}
          keyboardType={key==='email'?'email-address':key==='phone'?'phone-pad':'default'}/>)}
        <GlassButton lang={lang} primary label={t.save} onPress={saveFields}/>
        {section==='personal'&&account.photo!==''&&<GlassButton lang={lang} icon="close" label={t.removePhoto} onPress={()=>{
          if(update({photo:''})){setPhotoFailed(false);setPhotoMessage('');setMessage(t.saved)}else setMessage(t.storageError)}}/>}
        {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone={message===t.emailInvalid||message===t.storageError||message===t.emailServerError?'danger':'success'}>{message}</Note></View>}
      </>}

      {section==='documents'&&(documents.length?<View>{documents.map((item,i)=><View key={item.key} style={[styles.item,{flexDirection:row},i===documents.length-1&&g.noBorder]}>
          <Icon name="file" size={18} color={colors.brand}/><View style={g.flex1}><Txt lang="en" style={g.valueText} numberOfLines={2}>{item.name}</Txt></View>
        </View>)}</View>:<Txt lang={lang} style={g.body}>{t.emptyDocs}</Txt>)}

      {section==='favorites'&&<>
        {favorites.length?<View>{favorites.map((item,i)=><ScalePressable key={item.id} onPress={()=>onFavorite(item.id)} accessibilityRole="button" accessibilityLabel={item.label}
            style={[styles.item,{flexDirection:row},i===favorites.length-1&&g.noBorder]}>
            <Icon name="star" size={18} color={colors.brand} filled/><View style={g.flex1}><Txt lang={lang} bold style={g.valueText}>{item.label}</Txt></View><Icon name={forward} size={16} color={colors.muted}/>
          </ScalePressable>)}</View>:<Txt lang={lang} style={g.body}>{t.emptyFavorites}</Txt>}
        <GlassButton lang={lang} icon="grid" label={t.browse} onPress={onBrowse}/>
      </>}

      {section==='notifications'&&<>
        {alerts.length?<View>{alerts.map((a,i)=><ScalePressable key={a.id} onPress={onRequests} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.note}`}
            style={[styles.item,{flexDirection:row},i===alerts.length-1&&g.noBorder]}>
            <View style={styles.alertIcon}><Icon name="info" size={18} color="#76592A"/></View>
            <View style={g.flex1}><Txt lang={lang} bold style={g.valueText}>{a.title}</Txt><Txt lang={lang} style={g.meta}>{a.note}</Txt></View>
            <Icon name={forward} size={16} color={colors.muted}/>
          </ScalePressable>)}</View>:<Txt lang={lang} style={g.body}>{t.emptyNotifications}</Txt>}
        <GlassButton lang={lang} icon="file" label={t.openRequests} onPress={onRequests}/>
      </>}

      {section==='security'&&<>
        <Txt lang={lang} style={g.body}>{signedIn?t.signedInNote:t.privacy}</Txt>
        <View style={[styles.pair,{flexDirection:row}]}>
          <GlassButton lang={lang} fill compact label={t.terms} onPress={()=>onLegal('terms')}/>
          <GlassButton lang={lang} fill compact label={t.policy} onPress={()=>onLegal('privacy')}/>
        </View>
        {signedIn&&<>
          <GlassButton lang={lang} icon="download" label={t.exportData} busy={working&&!confirmDelete} onPress={()=>{if(!working)void run(onExport,t.exported)}}/>
          <GlassButton lang={lang} icon="power" label={t.signOut} disabled={working} onPress={()=>{if(!working)void run(async()=>{await onSignOut()})}}/>
          {!confirmDelete
            ?<ScalePressable accessibilityRole="button" onPress={()=>setConfirmDelete(true)} style={[styles.danger,{flexDirection:row}]}>
              <Icon name="close" size={18} color={colors.danger}/><Txt lang={lang} bold style={styles.dangerText}>{t.deleteAccount}</Txt>
            </ScalePressable>
            :<View style={styles.confirm}>
              <Note lang={lang} tone="danger">{t.deleteWarn}</Note>
              <ScalePressable accessibilityRole="button" accessibilityState={{disabled:working,busy:working}} disabled={working} onPress={()=>{if(!working)void run(onDelete)}}
                rippleColor="rgba(255,255,255,0.3)" style={[styles.dangerFill,{flexDirection:row},working&&g.disabled]}>
                <Txt lang={lang} bold style={styles.dangerFillText}>{t.deleteConfirm}</Txt>
              </ScalePressable>
              <GlassButton lang={lang} label={t.cancel} onPress={()=>setConfirmDelete(false)}/>
            </View>}
          {!!privacyMsg&&<View accessibilityLiveRegion="polite"><Note lang={lang}>{privacyMsg}</Note></View>}
        </>}
      </>}

      {section==='language'&&<View accessibilityRole="radiogroup" style={styles.languages}>
        {LANGS.map(code=>{const on=lang===code;return <ScalePressable key={code} accessibilityRole="radio" accessibilityState={{checked:on}} aria-checked={on}
          accessibilityLabel={LANG_INFO[code].native} onPress={()=>onLanguage(code)} style={[styles.radio,{flexDirection:row},on&&styles.radioOn]}>
          <View style={[styles.radioDot,on&&styles.radioDotOn]}>{on&&<View style={styles.radioInner}/>}</View>
          <View style={g.flex1}><Txt lang={code} bold style={g.valueText}>{LANG_INFO[code].native}</Txt></View>
        </ScalePressable>})}
      </View>}
    </GlassCard>}
  </GlassScreen>;
}

const styles=StyleSheet.create({
  logo:{width:44,height:44,borderRadius:22,borderWidth:1.5,borderColor:'#D9BC7E'},
  identity:{alignItems:'center',gap:space.md},
  identityText:{gap:2},
  name:{fontSize:type.title2,lineHeight:30},
  pill:{alignItems:'center',gap:4,paddingVertical:3,paddingHorizontal:space.sm,borderRadius:radius.pill,backgroundColor:colors.brandTint,marginTop:space.xs},
  pillText:{fontSize:type.caption,lineHeight:16,color:colors.brand},
  avatarButton:{width:80,height:80},
  avatar:{width:76,height:76,borderRadius:38,overflow:'hidden',borderWidth:1.5,borderColor:'#D9BC7E',alignItems:'center',justifyContent:'center',backgroundColor:'#E8EDFB'},
  photo:{width:'100%',height:'100%'},
  camera:{position:'absolute',bottom:0,right:0,width:30,height:30,borderRadius:15,backgroundColor:colors.orange,borderWidth:2,borderColor:colors.white,alignItems:'center',justifyContent:'center'},
  shortcuts:{gap:space.sm},
  shortcut:{flex:1,minHeight:88,alignItems:'center',justifyContent:'center',gap:2,paddingHorizontal:space.xs,borderRadius:radius.card,
    backgroundColor:'rgba(255,255,255,0.85)',borderWidth:1,borderColor:'rgba(255,255,255,0.9)',overflow:'hidden'},
  shortcutAlert:{backgroundColor:'#F6EDD6',borderColor:'#D9BC7E'},
  count:{fontSize:type.title2,lineHeight:28},
  shortcutName:{fontSize:type.caption,lineHeight:16,textAlign:'center',color:colors.muted},
  menuItem:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+16,paddingVertical:space.sm,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  menuIcon:{width:36,height:36,borderRadius:radius.control-2,backgroundColor:colors.brandTint,alignItems:'center',justifyContent:'center'},
  label:{fontSize:type.subhead,lineHeight:22},
  badgeCount:{minWidth:24,height:24,borderRadius:12,paddingHorizontal:6,alignItems:'center',justifyContent:'center',backgroundColor:colors.orange},
  badgeCountText:{fontSize:type.caption,lineHeight:16,color:'#FFFFFF'},
  exit:{minHeight:52,alignItems:'center',justifyContent:'center',gap:space.sm,borderRadius:16,borderWidth:1,borderColor:'#E3B9AF',backgroundColor:'rgba(255,244,240,0.9)',overflow:'hidden'},
  exitText:{fontSize:type.subhead,color:colors.danger},
  item:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+8,paddingVertical:space.sm,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  alertIcon:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:'#F6EDD6'},
  pair:{gap:space.sm},
  danger:{minHeight:52,alignItems:'center',justifyContent:'center',gap:space.sm,borderRadius:16,borderWidth:1,borderColor:'#E3B9AF',backgroundColor:'rgba(255,244,240,0.9)',overflow:'hidden'},
  dangerText:{fontSize:type.subhead,color:colors.danger},
  confirm:{gap:space.sm},
  dangerFill:{minHeight:52,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:colors.danger,overflow:'hidden'},
  dangerFillText:{fontSize:type.subhead,color:'#FFFFFF'},
  languages:{gap:space.sm},
  radio:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+8,paddingHorizontal:space.md,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.7)',overflow:'hidden'},
  radioOn:{borderColor:colors.orange,backgroundColor:'#E8EDFB'},
  radioDot:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:colors.muted,alignItems:'center',justifyContent:'center'},
  radioDotOn:{borderColor:colors.orange},
  radioInner:{width:10,height:10,borderRadius:5,backgroundColor:colors.orange},
});
