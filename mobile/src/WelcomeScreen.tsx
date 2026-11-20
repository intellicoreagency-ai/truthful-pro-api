import React, {useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {Icon} from './Icons';
import {ApiError, apiEnabled, recordConsent, requestOtp, verifyOtp} from './api';
import {LEGAL_VERSION} from './legal';
import {phoneDigits} from './clientModel';

const cover = require('../assets/brand/cover-dubai.jpg');
const ink = '#FFF8EF';
const accent = '#FFE1AC';

type Language='ar'|'en';
type Mode='signIn'|'create'|'reset';

const copy={
 ar:{
  brand:'تروثفل برو',tagline:'خدمات تخليص المعاملات',
  signIn:'تسجيل الدخول',create:'إنشاء حساب جديد',reset:'استعادة كلمة المرور',
  intro:'ادخل إلى حسابك لمتابعة طلباتك ومعاملاتك.',
  createIntro:'يُفعّل إنشاء الحساب عند ربط التحقق من البريد الإلكتروني ورقم الهاتف.',
  resetIntro:'تتوفر استعادة كلمة المرور عند ربط خدمة تسجيل الدخول.',
  email:'البريد الإلكتروني',password:'كلمة المرور',show:'إظهار كلمة المرور',hide:'إخفاء كلمة المرور',
  remember:'تذكّرني',forgot:'نسيت كلمة المرور؟',or:'أو',guest:'المتابعة كضيف',back:'العودة إلى تسجيل الدخول',
  preview:'نسخة معاينة. تسجيل الدخول غير متاح حالياً.',
  otpIntro:'أدخل رقم جوالك وسنرسل لك رمز تحقق.',phone:'رقم الجوال (05XXXXXXXX)',code:'رمز التحقق (6 أرقام)',sendCode:'إرسال الرمز',verify:'تأكيد ودخول',changeNumber:'تغيير الرقم',
  agree:'أوافق على',terms:'شروط الاستخدام',and:'و',privacy:'سياسة الخصوصية',docConsent:'أوافق على معالجة مستنداتي لتنفيذ طلباتي، ويمكنني سحب موافقتي في أي وقت.',
  e_phone:'أدخل رقم جوال إماراتي صحيحاً.',e_consent:'يلزم الموافقة على الشروط والخصوصية ومعالجة المستندات.',e_many:'محاولات كثيرة. حاول لاحقاً.',e_code:'الرمز غير صحيح أو منتهي.',e_send:'تعذّر إرسال الرمز. حاول مرة أخرى.',e_net:'تعذّر الاتصال. تحقق من الإنترنت.',e_gen:'حدث خطأ. حاول مرة أخرى.',
 },
 en:{
  brand:'TRUTHFUL PRO',tagline:'Document Clearance Services',
  signIn:'Sign In',create:'Create an Account',reset:'Reset Password',
  intro:'Sign in to manage your requests and transactions.',
  createIntro:'Account creation will be available once email and phone verification are connected.',
  resetIntro:'Password reset will be available once sign-in is connected.',
  email:'Email address',password:'Password',show:'Show password',hide:'Hide password',
  remember:'Remember me',forgot:'Forgot password?',or:'or',guest:'Continue as Guest',back:'Back to Sign In',
  preview:'Preview only. Sign-in is currently unavailable.',
  otpIntro:'Enter your mobile number and we will send you a verification code.',phone:'Mobile number (05XXXXXXXX)',code:'Verification code (6 digits)',sendCode:'Send code',verify:'Verify and sign in',changeNumber:'Change number',
  agree:'I agree to the',terms:'Terms of Use',and:'and',privacy:'Privacy Policy',docConsent:'I consent to processing my documents to carry out my requests, and I can withdraw consent at any time.',
  e_phone:'Enter a valid UAE mobile number.',e_consent:'You must accept the Terms, Privacy Policy and document processing.',e_many:'Too many attempts. Try again later.',e_code:'The code is wrong or has expired.',e_send:'Could not send the code. Try again.',e_net:'Connection failed. Check your internet.',e_gen:'Something went wrong. Try again.',
 },
};

type Props={
 lang:Language; onLanguage:(lang:Language)=>void; onGuest:()=>void; onSignedIn:()=>void; onLegal:(kind:'terms'|'privacy')=>void; logo:number;
 Text:React.ComponentType<{lang:Language;children:React.ReactNode;style?:object}>;
 inputFont:string;
};

export function WelcomeScreen({lang,onLanguage,onGuest,onSignedIn,onLegal,logo,Text:T,inputFont}:Props) {
 const ar=lang==='ar';
 const row=ar?'row-reverse':'row';
 const t=copy[lang];
 const [mode,setMode]=useState<Mode>('signIn');
 const [showPassword,setShowPassword]=useState(false);
 const [remember,setRemember]=useState(false);
 const changeMode=(next:Mode)=>{setShowPassword(false);setMode(next);};
 const [phone,setPhone]=useState('');
 const [code,setCode]=useState('');
 const [challenge,setChallenge]=useState<string|null>(null);
 const [agreed,setAgreed]=useState(false);
 const [docOk,setDocOk]=useState(false);
 const [busy,setBusy]=useState(false);
 const [err,setErr]=useState('');
 const e164=():string|null=>{const d=phoneDigits(phone);const n=d.startsWith('971')?d:d.startsWith('0')?'971'+d.slice(1):d.length===9?'971'+d:'';return /^9715\d{8}$/.test(n)?'+'+n:null;};
 const fail=(e:unknown)=>{const c=e instanceof ApiError?e.code:'';setErr(c==='too_many_requests'?t.e_many:c==='invalid_code'?t.e_code:c==='delivery_failed'?t.e_send:c==='invalid_phone'?t.e_phone:c==='network'?t.e_net:t.e_gen);};
 const send=async()=>{setErr('');const p=e164();if(!p){setErr(t.e_phone);return}if(!agreed||!docOk){setErr(t.e_consent);return}setBusy(true);try{const r=await requestOtp(p,lang);setChallenge(r.challengeId);setCode('')}catch(e){fail(e)}finally{setBusy(false)}};
 const confirm=async()=>{setErr('');const p=e164();if(!p||!challenge)return;if(!/^\d{6}$/.test(phoneDigits(code))){setErr(t.e_code);return}setBusy(true);try{await verifyOtp(p,challenge,phoneDigits(code));await Promise.all([recordConsent('terms',LEGAL_VERSION,true),recordConsent('privacy',LEGAL_VERSION,true),recordConsent('document_processing',LEGAL_VERSION,true)]);onSignedIn()}catch(e){fail(e)}finally{setBusy(false)}};

 return <View style={s.cover}>
  <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
   <Image source={cover} resizeMode="cover" blurRadius={20} style={s.photo} accessible={false}/>
   <Image source={cover} resizeMode="contain" style={s.photo} accessible={false}/>
   <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} accessible={false}>
    <Defs>
     <LinearGradient id="signInShade" x1="0%" y1="0%" x2="0%" y2="100%">
      <Stop offset="0%" stopColor="#080E1C" stopOpacity={0.30}/>
      <Stop offset="22%" stopColor="#080E1C" stopOpacity={0}/>
      <Stop offset="37%" stopColor="#080E1C" stopOpacity={0.30}/>
      <Stop offset="58%" stopColor="#080E1C" stopOpacity={0.65}/>
      <Stop offset="100%" stopColor="#080E1C" stopOpacity={0.80}/>
     </LinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#signInShade)"/>
   </Svg>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
   <View style={[s.header,{flexDirection:row}]}>
     <View style={[s.brand,{flexDirection:row}]}>
       <Image source={logo} style={s.logo} accessible={false}/>
       <View style={s.wordmark}>
         <T lang={lang} style={s.brandName}>{t.brand}</T>
         <T lang={lang} style={s.tagline}>{t.tagline}</T>
       </View>
     </View>
     <View style={s.languageToggle}>
       {(['en','ar'] as const).map(item=><Pressable key={item} onPress={()=>onLanguage(item)}
         accessibilityRole="button" accessibilityState={{selected:lang===item}} accessibilityLabel={item==='en'?'English':'العربية'}
         style={[s.languageChoice,item===lang&&s.languageActive]}>
         <T lang={item} style={[s.languageText,item===lang&&s.languageTextActive]}>{item==='en'?'EN':'عربي'}</T>
       </Pressable>)}
     </View>
   </View>
   <View style={s.form}>
     <T lang={lang} style={s.heading}>{t[mode]}</T>
     <T lang={lang} style={s.intro}>{mode==='signIn'?t.intro:mode==='create'?t.createIntro:t.resetIntro}</T>
     {mode==='signIn'?<>
     {apiEnabled?<>
       <T lang={lang} style={s.preview}>{t.otpIntro}</T>
       <View style={[s.field,{flexDirection:row}]}>
         <Icon name="user" size={20} color={accent}/>
         <TextInput editable={!challenge&&!busy} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={16}
           accessibilityLabel={t.phone} placeholder={t.phone} placeholderTextColor={ink} style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left'}]}/>
       </View>
       {challenge?<View style={[s.field,{flexDirection:row}]}>
         <Icon name="lock" size={20} color={accent}/>
         <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} editable={!busy}
           accessibilityLabel={t.code} placeholder={t.code} placeholderTextColor={ink} style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left',letterSpacing:4}]}/>
       </View>:<>
         <Pressable accessibilityRole="checkbox" accessibilityState={{checked:agreed}} onPress={()=>setAgreed(v=>!v)} style={[s.inline,{flexDirection:row,alignItems:'flex-start'}]}>
           <View style={[s.check,agreed&&s.checked]}>{agreed&&<Icon name="check" size={13} color="#30251F"/>}</View>
           <T lang={lang} style={[s.linkText,{flex:1,textAlign:ar?'right':'left'}]}>{t.agree} {t.terms} {t.and} {t.privacy}</T>
         </Pressable>
         <View style={[s.legalRow,{flexDirection:row}]}>
           <Pressable accessibilityRole="link" onPress={()=>onLegal('terms')} style={s.inline}><T lang={lang} style={s.under}>{t.terms}</T></Pressable>
           <Pressable accessibilityRole="link" onPress={()=>onLegal('privacy')} style={s.inline}><T lang={lang} style={s.under}>{t.privacy}</T></Pressable>
         </View>
         <Pressable accessibilityRole="checkbox" accessibilityState={{checked:docOk}} onPress={()=>setDocOk(v=>!v)} style={[s.inline,{flexDirection:row,alignItems:'flex-start'}]}>
           <View style={[s.check,docOk&&s.checked]}>{docOk&&<Icon name="check" size={13} color="#30251F"/>}</View>
           <T lang={lang} style={[s.linkText,{flex:1,textAlign:ar?'right':'left'}]}>{t.docConsent}</T>
         </Pressable>
       </>}
       {err?<T lang={lang} style={s.error}>{err}</T>:null}
       <Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} onPress={challenge?confirm:send} style={({pressed})=>[s.primary,s.cta,{flexDirection:row},(pressed||busy)&&{opacity:.7}]}>
         <Icon name="lock" size={18} color="#30251F"/><T lang={lang} style={[s.primaryText,s.guestText]}>{challenge?t.verify:t.sendCode}</T>
       </Pressable>
       {challenge?<Pressable accessibilityRole="button" onPress={()=>{setChallenge(null);setCode('');setErr('')}} style={s.inline}><T lang={lang} style={s.linkText}>{t.changeNumber}</T></Pressable>:null}
     </>:<>
       <T lang={lang} style={s.preview}>{t.preview}</T>
       <View style={[s.field,{flexDirection:row}]}>
         <Icon name="mail" size={20} color={accent}/>
         <TextInput editable={false} accessibilityLabel={t.email} accessibilityState={{disabled:true}}
           placeholder={t.email} placeholderTextColor={ink} style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left'}]}/>
       </View>
       <View style={[s.field,{flexDirection:row}]}>
         <Icon name="lock" size={20} color={accent}/>
         <TextInput editable={false} accessibilityLabel={t.password} accessibilityState={{disabled:true}}
           placeholder={t.password} placeholderTextColor={ink} secureTextEntry={!showPassword} style={[s.input,{fontFamily:inputFont,textAlign:ar?'right':'left'}]}/>
         <Pressable accessibilityRole="button" accessibilityLabel={showPassword?t.hide:t.show}
           onPress={()=>setShowPassword(value=>!value)} style={s.eye}>
           <Icon name={showPassword?'eye':'eyeOff'} size={19} color={accent}/>
         </Pressable>
       </View>
       <View style={[s.options,{flexDirection:row}]}>
         <Pressable accessibilityRole="checkbox" accessibilityState={{checked:remember}} onPress={()=>setRemember(value=>!value)}
           style={[s.inline,{flexDirection:row}]}>
           <View style={[s.check,remember&&s.checked]}>{remember&&<Icon name="check" size={13} color="#30251F"/>}</View>
           <T lang={lang} style={s.linkText}>{t.remember}</T>
         </Pressable>
         <Pressable accessibilityRole="button" onPress={()=>changeMode('reset')} style={s.inline}>
           <T lang={lang} style={s.linkText}>{t.forgot}</T>
         </Pressable>
       </View>
       <Pressable accessibilityRole="button" accessibilityState={{disabled:true}} disabled style={[s.primary,s.unavailable,{flexDirection:row}]}>
         <Icon name="lock" size={18} color={accent}/><T lang={lang} style={s.primaryText}>{t.signIn}</T>
       </Pressable>
       <View style={s.divider}><View style={s.rule}/><T lang={lang} style={s.intro}>{t.or}</T><View style={s.rule}/></View>
       <Pressable accessibilityRole="button" onPress={()=>changeMode('create')} style={[s.secondary,{flexDirection:row}]}>
         <Icon name="user" size={19} color={accent}/><T lang={lang} style={s.primaryText}>{t.create}</T>
       </Pressable>
     </>}
     </>:<Pressable accessibilityRole="button" onPress={()=>changeMode('signIn')} style={s.secondary}>
       <T lang={lang} style={s.primaryText}>{t.back}</T>
     </Pressable>}
     <Pressable accessibilityRole="button" onPress={onGuest} style={({pressed})=>[s.primary,s.guest,{flexDirection:row},pressed&&{opacity:.78}]}>
       <T lang={lang} style={[s.primaryText,s.guestText]}>{t.guest}</T><Icon name={ar?'back':'next'} size={18} color="#30251F"/>
     </Pressable>
   </View>
  </ScrollView>
 </View>;
}

const s=StyleSheet.create({
 cover:{flex:1,backgroundColor:'#101D36'},
 photo:{...StyleSheet.absoluteFill,width:'100%',height:'100%'},
 content:{flexGrow:1,justifyContent:'space-between',paddingHorizontal:16,paddingTop:12,paddingBottom:16,gap:145},
 header:{alignItems:'center',justifyContent:'space-between',gap:8},
 languageToggle:{flexDirection:'row',padding:2,borderRadius:14,borderWidth:1,borderColor:'#AF9570',backgroundColor:'#132039'},
 languageChoice:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center',borderRadius:11,paddingHorizontal:4},
 languageActive:{backgroundColor:'#F8D9AD'},
 languageText:{fontSize:12,fontWeight:'800',textAlign:'center',color:'#FFF8EE'},
 languageTextActive:{color:'#30251F'},
 brand:{flex:1,alignItems:'center',gap:7},
 logo:{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:'#D6A45D'},
 wordmark:{flex:1},
 brandName:{fontSize:15,lineHeight:20,fontWeight:'900',color:'#FFF9F4'},
 tagline:{fontSize:10,lineHeight:14,fontWeight:'800',color:'#F2DEC2'},
 form:{gap:6,paddingHorizontal:2},
 heading:{fontSize:28,lineHeight:36,fontWeight:'900',textAlign:'center',color:ink,textShadowColor:'#050812',textShadowRadius:8},
 intro:{fontSize:12,lineHeight:18,color:ink,textAlign:'center',textShadowColor:'#050812',textShadowRadius:5},
 preview:{fontSize:11,lineHeight:17,color:accent,paddingBottom:4,textAlign:'center',textShadowColor:'#050812',textShadowRadius:5},
 field:{minHeight:46,alignItems:'center',gap:8,paddingHorizontal:11,borderRadius:13,borderWidth:1,borderColor:'#C5B5A1',backgroundColor:'rgba(13,20,34,0.58)'},
 input:{flex:1,minWidth:0,minHeight:44,fontSize:13,color:ink},
 eye:{width:44,height:44,marginHorizontal:-7,justifyContent:'center',alignItems:'center'},
 options:{justifyContent:'space-between',alignItems:'center',gap:8},
 inline:{minHeight:44,alignItems:'center',gap:7,justifyContent:'center'},
 check:{width:17,height:17,borderRadius:4,borderWidth:1,borderColor:accent,alignItems:'center',justifyContent:'center'},
 checked:{backgroundColor:'#FFB341'},
 linkText:{fontSize:11,fontWeight:'800',color:accent,textShadowColor:'#050812',textShadowRadius:5},
 primary:{minHeight:46,alignItems:'center',justifyContent:'center',gap:7,borderRadius:13,paddingHorizontal:9},
 unavailable:{backgroundColor:'rgba(30,38,53,0.72)',borderColor:'#AD9B81',borderWidth:1},
 primaryText:{fontSize:14,fontWeight:'900',textAlign:'center',color:ink},
 divider:{flexDirection:'row',alignItems:'center',gap:9},
 rule:{height:1,backgroundColor:'rgba(255,225,172,0.43)',flex:1},
 secondary:{minHeight:46,justifyContent:'center',alignItems:'center',gap:7,borderRadius:13,borderWidth:1,borderColor:accent,backgroundColor:'rgba(13,20,34,0.46)',paddingHorizontal:9},
 guest:{backgroundColor:'#FFAA42'},
 cta:{backgroundColor:'#FFAA42'},
 legalRow:{gap:22,justifyContent:'center'},
 under:{textDecorationLine:'underline',fontWeight:'900',color:'#FFE1AC'},
 error:{fontSize:12,lineHeight:18,color:'#FFC9B8',textAlign:'center',textShadowColor:'#050812',textShadowRadius:5},
 guestText:{color:'#30251F'},
});

