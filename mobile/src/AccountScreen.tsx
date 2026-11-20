import React, {useEffect, useRef, useState} from 'react';
import {BackHandler, Image, Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {Icon, type IconName} from './Icons';
import {chooseAccountPhoto, type AccountData} from './accountStorage';

type Language='ar'|'en';
type Section='personal'|'company'|'documents'|'notifications'|'security'|'language'|'favorites';
type Field='name'|'email'|'phone'|'company'|'license';

const ui={
  ar:{
    title:'حسابي',guest:'ضيف',individual:'عميل أفراد',business:'عميل شركات',local:'حساب محلي للمعاينة',
    person:'بياناتي الشخصية',personHint:'عرض وتحديث بياناتك ومعلومات التواصل',
    company:'بيانات الشركة',companyHint:'إدارة معلومات شركتك',
    docs:'المستندات المحفوظة',docsHint:'الملفات المرفقة بمسوداتك في هذه الجلسة',
    notifications:'الإشعارات',notificationsHint:'تنبيهات حالة الطلبات والتحديثات',
    security:'الأمان والخصوصية',securityHint:'إدارة خصوصية بياناتك في المعاينة',
    language:'اللغة',requests:'طلباتي',favorites:'المفضلة',exit:'الخروج من صفحة الحساب',back:'رجوع إلى حسابي',
    addPhoto:'إضافة صورة شخصية',changePhoto:'تغيير الصورة الشخصية',removePhoto:'إزالة الصورة الشخصية',
    photoSize:'حجم الصورة يتجاوز ٢ ميغابايت. اختر صورة أصغر.',
    photoFormat:'اختر صورة بصيغة JPG أو PNG أو WebP.',
    photoError:'تعذّر فتح الصورة. جرّب صورة أخرى.',
    storageError:'تعذّر الحفظ على هذا الجهاز.',
    save:'حفظ',saved:'تم الحفظ على هذا الجهاز.',emptyDocs:'لا توجد مستندات مرفقة في هذه الجلسة.',
    emptyNotifications:'لا توجد إشعارات جديدة.',emptyFavorites:'لم تضف أي خدمة إلى المفضلة.',
    browse:'تصفّح الخدمات',settings:'إعدادات الحساب',
    privacy:'تُحفظ صورة الحساب وبياناته على هذا الجهاز. تسجيل الدخول والتحقق من الهوية غير متاحين في المعاينة.',
    terms:'شروط الاستخدام',policy:'سياسة الخصوصية',exportData:'تصدير بياناتي',deleteAccount:'حذف حسابي',deleteWarn:'سيُحذف حسابك وطلباتك ومستنداتك نهائياً ولا يمكن التراجع.',deleteConfirm:'نعم، احذف كل شيء',cancel:'إلغاء',signOut:'تسجيل الخروج',working:'جارٍ التنفيذ…',exported:'تم تجهيز نسخة من بياناتك.',failed:'تعذّر التنفيذ. تحقق من الاتصال وحاول مجدداً.',signedInNote:'حسابك مرتبط بالخادم. لك حق الاطلاع على بياناتك وتصحيحها وحذفها.',
    name:'الاسم الكامل',email:'البريد الإلكتروني',phone:'رقم الهاتف',companyName:'اسم الشركة',license:'رقم الرخصة',
  },
  en:{
    title:'My Account',guest:'Guest',individual:'Individual client',business:'Company client',local:'Local preview profile',
    person:'Personal Information',personHint:'View and update your contact details',
    company:'Company Information',companyHint:'Manage your company details',
    docs:'Saved Documents',docsHint:'Files attached to drafts in this session',
    notifications:'Notifications',notificationsHint:'Request updates and alerts',
    security:'Security & Privacy',securityHint:'Manage your privacy in the preview',
    language:'Language',requests:'My Requests',favorites:'Favorites',exit:'Leave Account',back:'Back to My Account',
    addPhoto:'Add profile photo',changePhoto:'Change profile photo',removePhoto:'Remove profile photo',
    photoSize:'Choose a photo under 2 MB.',photoFormat:'Choose a JPG, PNG or WebP image.',
    photoError:'Could not open the photo. Try a different image.',storageError:'Could not save to this device.',
    save:'Save',saved:'Saved on this device.',emptyDocs:'No documents attached in this session.',
    emptyNotifications:'No new notifications.',emptyFavorites:'You haven’t added any favorite services.',
    browse:'Browse Services',settings:'Account Settings',
    privacy:'Your profile and photo are stored on this device. Sign-in and identity verification are unavailable in this preview.',
    terms:'Terms of Use',policy:'Privacy Policy',exportData:'Export my data',deleteAccount:'Delete my account',deleteWarn:'Your account, requests and documents will be permanently deleted. This cannot be undone.',deleteConfirm:'Yes, delete everything',cancel:'Cancel',signOut:'Sign out',working:'Working…',exported:'A copy of your data is ready.',failed:'Could not complete. Check your connection and try again.',signedInNote:'Your account is linked to our server. You can access, correct and delete your data.',
    name:'Full name',email:'Email address',phone:'Phone number',companyName:'Company name',license:'Trade licence number',
  },
};

type Props={
  lang:Language;
  account:AccountData;
  update:(data:Partial<AccountData>)=>boolean;
  requests:number;
  documents:{key:string;name:string}[];
  favorites:{id:string;label:string}[];
  onFavorite:(id:string)=>void;
  onRequests:()=>void;
  onBrowse:()=>void;
  onLanguage:(lang:Language)=>void;
  onLeave:()=>void;
  signedIn:boolean;
  onLegal:(kind:'terms'|'privacy')=>void;
  onExport:()=>Promise<boolean>;
  onDelete:()=>Promise<boolean>;
  onSignOut:()=>Promise<void>;
  logo:number;
  Text:React.ComponentType<{lang:Language;children:React.ReactNode;style?:object;numberOfLines?:number}>;
  inputFont:string;
};

export function AccountScreen({lang,account,update,requests,documents,favorites,onFavorite,onRequests,onBrowse,onLanguage,onLeave,signedIn,onLegal,onExport,onDelete,onSignOut,logo,Text:T,inputFont}:Props) {
  const ar=lang==='ar';
  const row=ar?'row-reverse':'row';
  const forward=ar?'back':'next';
  const t=ui[lang];
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

  const open=(next:Section|null)=>{
    setEdits({});
    setMessage('');
    setSection(next);
    scroll.current?.scrollTo({y:0,animated:false});
  };
  useEffect(()=>{
    if(!section) return;
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{open(null);return true;});
    return ()=>sub.remove();
  },[section]);
  const pickPhoto=async()=>{
    if(pickerPending.current) return;
    pickerPending.current=true;
    setPhotoMessage('');
    try {
      const photo=await chooseAccountPhoto();
      if(photo){
        if(update({photo})){setPhotoFailed(false);setPhotoMessage(t.saved);}
        else setPhotoMessage(t.storageError);
      }
    }catch(error){
      const reason=error instanceof Error?error.message:'';
      setPhotoMessage(reason==='format'?t.photoFormat:reason==='size'?t.photoSize:t.photoError);
    }finally{
      pickerPending.current=false;
    }
  };
  const photoAction=account.photo?t.changePhoto:t.addPhoto;
  const sections:Record<Section,{title:string;description:string;icon:IconName}>={
    personal:{title:t.person,description:t.personHint,icon:'user'},
    company:{title:t.company,description:t.companyHint,icon:'places'},
    documents:{title:t.docs,description:t.docsHint,icon:'folder'},
    notifications:{title:t.notifications,description:t.notificationsHint,icon:'bell'},
    security:{title:t.security,description:t.securityHint,icon:'shield'},
    language:{title:t.language,description:ar?'العربية':'English',icon:'globe'},
    favorites:{title:t.favorites,description:'',icon:'star'},
  };
  const shortcut=(label:string,value:number,icon:IconName,onPress:()=>void)=>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label+', '+value}
      style={({pressed})=>[s.shortcut,pressed&&s.pressed]}>
      <Icon name={icon} size={22}/>
      <T lang={lang} style={s.shortcutName}>{label}</T>
      <T lang={lang} style={s.count}>{value}</T>
    </Pressable>;
  const button=(label:string,onPress:()=>void)=> <Pressable accessibilityRole="button" onPress={onPress}
    style={({pressed})=>[s.button,pressed&&s.pressed]}><T lang={lang} style={s.buttonText}>{label}</T></Pressable>;
  const fields:readonly [Field,string][] = section==='company'
    ? [['company',t.companyName],['license',t.license]]
    : [['name',t.name],['email',t.email],['phone',t.phone]];
  const saveFields=()=>setMessage(update(edits)?t.saved:t.storageError);

  return <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.page}>
    <View style={[s.header,{flexDirection:row}]}>
      {section?<Pressable accessibilityRole="button" accessibilityLabel={t.back} style={s.headerButton} onPress={()=>open(null)}>
        <Icon name={ar?'next':'back'}/>
      </Pressable>:<Pressable accessibilityRole="button" accessibilityLabel={t.settings} style={s.headerButton} onPress={()=>open('security')}>
        <Icon name="settings"/>
      </Pressable>}
      <Image source={logo} style={s.logo} accessibilityIgnoresInvertColors accessible={false}/>
      <Pressable accessibilityRole="button" accessibilityLabel={t.notifications} style={s.headerButton} onPress={()=>open('notifications')}>
        <Icon name="bell"/>
      </Pressable>
    </View>
    <T lang={lang} style={s.heading}>{section?sections[section].title:t.title}</T>
    {!section?<View style={s.overview}>
      <View style={[s.identity,{flexDirection:row}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={photoAction} style={s.avatarButton} onPress={pickPhoto}>
          <View style={s.avatar}>
            {account.photo&&!photoFailed?<Image key={account.photo} source={{uri:account.photo}} style={s.photo}
              onError={()=>{setPhotoFailed(true);setPhotoMessage(t.photoError);}} accessible={false}/>:<Icon name="user" size={35}/>}
          </View>
          <View style={s.camera}><Icon name="camera" size={18} color="#30251F"/></View>
        </Pressable>
        <View style={s.identityText}>
          <T lang={lang} style={s.name} numberOfLines={2}>{account.name||t.guest}</T>
          <T lang={lang} style={s.sub}>{account.company?t.business:t.individual}</T>
          <View style={[s.badge,{alignSelf:ar?'flex-end':'flex-start',flexDirection:row}]}>
            <Icon name="shield" size={14}/>
            <T lang={lang} style={s.badgeLabel}>{t.local}</T>
          </View>
        </View>
      </View>
      {!!photoMessage&&<T lang={lang} style={s.sub}>{photoMessage}</T>}
      <View style={[s.shortcuts,{flexDirection:row}]}>
        {shortcut(t.favorites,favorites.length,'star',()=>open('favorites'))}
        {shortcut(t.requests,requests,'file',onRequests)}
        {shortcut(t.notifications,0,'bell',()=>open('notifications'))}
      </View>
      <View style={s.menu}>
        {(['personal','company','notifications','security','language'] as const).map(key=>{
          const item=sections[key];
          return <Pressable key={key} onPress={()=>open(key)} accessibilityRole="button" accessibilityLabel={item.title}
            style={({pressed})=>[s.menuItem,{flexDirection:row},pressed&&s.pressed]}>
            <View style={s.menuIcon}><Icon name={item.icon} size={21}/></View>
            <View style={s.menuText}><T lang={lang} style={s.label}>{item.title}</T><T lang={lang} style={s.sub}>{item.description}</T></View>
            <Icon name={forward} size={17}/>
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={onLeave} style={({pressed})=>[s.exit,{flexDirection:row},pressed&&s.pressed]}>
        <Icon name="power" size={19} color="#9C3B30"/><T lang={lang} style={s.exitText}>{t.exit}</T>
      </Pressable>
    </View>:<View style={s.panel}>
      {(section==='personal'||section==='company')&&<>
        {fields.map(([key,label])=><View key={key} style={s.field}>
          <T lang={lang} style={s.label}>{label}</T>
          <TextInput value={edits[key]??account[key]} onChangeText={value=>setEdits(previous=>({...previous,[key]:value}))}
            accessibilityLabel={label} autoCapitalize={key==='email'?'none':'sentences'}
            keyboardType={key==='email'?'email-address':key==='phone'?'phone-pad':'default'}
            style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left'}]}/>
        </View>)}
        {button(t.save,saveFields)}
        {section==='personal'&&account.photo!==''&&button(t.removePhoto,()=>{
          if(update({photo:''})){setPhotoFailed(false);setPhotoMessage('');setMessage(t.saved);}
          else setMessage(t.storageError);
        })}
        {!!message&&<T lang={lang} style={s.sub}>{message}</T>}
      </>}
      {section==='documents'&&(documents.length?documents.map(item=>
        <View key={item.key} style={[s.item,{flexDirection:row}]}>
          <Icon name="file" size={18}/><T lang={lang} style={s.menuText} numberOfLines={2}>{item.name}</T>
        </View>):<T lang={lang} style={s.sub}>{t.emptyDocs}</T>)}
      {section==='favorites'&&<>
        {favorites.length?favorites.map(item=>
          <Pressable key={item.id} onPress={()=>onFavorite(item.id)} accessibilityRole="button" style={[s.item,{flexDirection:row}]}>
            <Icon name="star" size={18}/><T lang={lang} style={s.menuText}>{item.label}</T><Icon name={forward} size={17}/>
          </Pressable>):<T lang={lang} style={s.sub}>{t.emptyFavorites}</T>}
        {button(t.browse,onBrowse)}
      </>}
      {section==='notifications'&&<T lang={lang} style={s.sub}>{t.emptyNotifications}</T>}
      {section==='security'&&<>
        <T lang={lang} style={s.sub}>{signedIn?t.signedInNote:t.privacy}</T>
        {button(t.terms,()=>onLegal('terms'))}
        {button(t.policy,()=>onLegal('privacy'))}
        {signedIn&&<>
          {button(t.exportData,()=>{if(!working)void run(onExport,t.exported)})}
          {!confirmDelete?button(t.deleteAccount,()=>setConfirmDelete(true)):<>
            <T lang={lang} style={[s.sub,{color:'#9C2B14'}]}>{t.deleteWarn}</T>
            {button(t.deleteConfirm,()=>{if(!working)void run(onDelete)})}
            {button(t.cancel,()=>setConfirmDelete(false))}
          </>}
          {button(t.signOut,()=>{if(!working)void run(async()=>{await onSignOut()})})}
          {!!privacyMsg&&<T lang={lang} style={s.sub}>{privacyMsg}</T>}
        </>}
      </>}
      {section==='language'&&<>
        {button(lang==='ar'?'العربية ✓':'العربية',()=>onLanguage('ar'))}
        {button(lang==='en'?'English ✓':'English',()=>onLanguage('en'))}
      </>}
    </View>}
  </ScrollView>;
}

const s=StyleSheet.create({
  page:{paddingHorizontal:16,paddingTop:10,paddingBottom:24},
  header:{justifyContent:'space-between',alignItems:'center',marginBottom:8},
  headerButton:{width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF9F4',borderRadius:15,borderColor:'#E9DACC',borderWidth:1},
  logo:{width:54,height:54,borderRadius:27,borderWidth:1.5,borderColor:'#DDA04B'},
  heading:{fontSize:27,lineHeight:36,fontWeight:'900',marginBottom:12},
  overview:{gap:11},
  identity:{alignItems:'center',gap:13,padding:13,minHeight:115,borderRadius:20,borderColor:'#D8AA6C',borderWidth:1,
    backgroundColor:'#F7E7D3'},
  identityText:{flex:1,gap:3},
  name:{fontSize:22,lineHeight:28,fontWeight:'900'},
  sub:{fontSize:12,lineHeight:18,color:'#6B5749'},
  badge:{alignItems:'center',gap:4,paddingVertical:4,paddingHorizontal:7,borderRadius:9,backgroundColor:'#FFF8ED',marginTop:4},
  badgeLabel:{fontSize:11,fontWeight:'800',color:'#725028'},
  avatarButton:{width:82,height:82},
  avatar:{width:78,height:78,borderRadius:39,overflow:'hidden',borderWidth:1.5,borderColor:'#CF944A',
    alignItems:'center',justifyContent:'center',backgroundColor:'#FFF5E6'},
  photo:{width:'100%',height:'100%'},
  camera:{position:'absolute',bottom:0,right:0,width:33,height:33,borderRadius:17,backgroundColor:'#FF8A00',
    borderWidth:2,borderColor:'#FFF8E9',alignItems:'center',justifyContent:'center'},
  shortcuts:{gap:8},
  shortcut:{flex:1,borderRadius:16,minHeight:80,alignItems:'center',justifyContent:'center',gap:3,paddingHorizontal:4,
    backgroundColor:'#FFF9F2',borderColor:'#E9D0AF',borderWidth:1},
  shortcutName:{fontSize:11,fontWeight:'800',textAlign:'center'},
  count:{fontSize:19,lineHeight:23,fontWeight:'900'},
  menu:{gap:6},
  menuItem:{alignItems:'center',gap:9,minHeight:53,paddingHorizontal:10,paddingVertical:6,backgroundColor:'#FFF9F2',
    borderColor:'#E9DACC',borderWidth:1,borderRadius:14},
  menuIcon:{width:31,height:31,borderRadius:10,backgroundColor:'#F6E6D2',alignItems:'center',justifyContent:'center'},
  menuText:{flex:1},
  label:{fontSize:14,lineHeight:20,fontWeight:'800'},
  exit:{borderWidth:1,borderColor:'#DAB7AC',borderRadius:14,backgroundColor:'#FFF4F0',minHeight:44,
    justifyContent:'center',alignItems:'center',gap:7},
  exitText:{color:'#963B31',fontSize:13,fontWeight:'800'},
  pressed:{opacity:.75},
  panel:{padding:13,borderWidth:1,borderColor:'#E9DACC',borderRadius:16,backgroundColor:'#FFF9F2',gap:10},
  field:{gap:4},
  input:{minHeight:44,borderRadius:10,paddingHorizontal:9,borderWidth:1,borderColor:'#D9C5AE',backgroundColor:'#FFFDF8',color:'#30251F'},
  button:{minHeight:44,paddingHorizontal:10,borderRadius:12,backgroundColor:'#F6E4CA',alignItems:'center',justifyContent:'center'},
  buttonText:{fontSize:13,fontWeight:'800'},
  item:{alignItems:'center',gap:8,minHeight:42},
});

