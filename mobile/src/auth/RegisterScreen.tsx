import React,{useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {ApiError,logout,recordConsent,setPassword,setServerEmail,setServerName} from '../api';
import {LEGAL_VERSION,PRIVACY_VERSION} from '../legal';
import {authCopy,type Lang} from './copy';
import {PHONE_PREFIX,isEmail,toE164} from './phone';
import {AuthScaffold,ConsentRow,PrimaryButton,RoundedField,SecondaryButton,TextLink,type AuthText,AText} from './AuthKit';
import {PasswordField} from './PasswordField';
import {useWaVerification} from './useWaVerification';
import {Icon} from '../Icons';
import {glass,authGlass,space,type} from '../theme';
import {pick} from '../i18n';

type Props={
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;inputFont?:string;
  /** 'register' = full form incl. the phone and its WhatsApp confirmation; 'complete' = the number was just confirmed elsewhere. */
  mode:'register'|'complete';
  onSignedIn:(verifiedPhone?:string)=>void;onLogin:()=>void;onLegal:(k:'terms'|'privacy')=>void;
};
const LRI='⁦',PDI='⁩';
const strong=(p:string)=>p.length>=8&&/\p{L}/u.test(p)&&/\d/.test(p);

/**
 * Create account (glass screen): name, email, password, mobile number. Right under the number, a box: "this number has WhatsApp,
 * confirm it with one message". Ticking it opens WhatsApp with a ready-made message in the app language; the customer taps Send and
 * comes back, and the box turns into "number confirmed" by itself. Confirmation is required. Then the consents, and the account is created.
 */
export function RegisterScreen({lang,onLanguage,logo,inputFont,mode,onSignedIn,onLogin,onLegal}:Props){
  const t=pick(authCopy,lang),ar=lang==='ar';
  const T=AText;
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [pw,setPw]=useState('');const [phone,setPhone]=useState(PHONE_PREFIX);
  const [terms,setTerms]=useState(false);const [privacy,setPrivacy]=useState(false);const [docs,setDocs]=useState(false);
  const [waBox,setWaBox]=useState(false);const [verified,setVerified]=useState(mode==='complete');const [existing,setExisting]=useState(false);
  const [errors,setErrors]=useState<{name?:string;email?:string;password?:string;phone?:string;consent?:string}>({});
  const [saveError,setSaveError]=useState('');const [saving,setSaving]=useState(false);
  const wa=useWaVerification(lang,info=>{setVerified(true);setExisting(!info.isNewUser);setErrors(x=>({...x,phone:undefined}));});
  const clear=(k:keyof typeof errors)=>setErrors(x=>({...x,[k]:undefined}));

  const toggleWa=()=>{
    if(verified)return; // locked once confirmed; use "Change number"
    if(waBox){wa.cancel();setWaBox(false);return;}
    const p=toE164(phone);
    if(!p){setErrors(x=>({...x,phone:t.e_phone}));return;}
    setWaBox(true);clear('phone');void wa.start(p,{open:true});
  };
  const changeNumber=()=>{wa.cancel();setWaBox(false);if(verified&&mode==='register'){setVerified(false);setExisting(false);void logout().catch(()=>{});}};

  const validate=()=>{
    const e:typeof errors={};
    if(name.trim().length<2)e.name=t.e_name;
    if(!email.trim())e.email=t.e_email_req;else if(!isEmail(email))e.email=t.e_email;
    if(!strong(pw))e.password=t.e_weak;
    if(mode==='register'&&!verified)e.phone=toE164(phone)?t.waRequired:t.e_phone;
    if(!terms||!privacy||!docs)e.consent=t.e_consent;
    setErrors(e);return Object.keys(e).length===0;
  };
  /** The session already exists (the WhatsApp confirmation signed the person in): save the consents, email, password and name. */
  const create=async()=>{
    if(!validate())return;
    setSaving(true);setSaveError('');
    const net=(e:unknown)=>e instanceof ApiError&&e.code==='network';
    try{await Promise.all([recordConsent('terms',LEGAL_VERSION,true),recordConsent('privacy',PRIVACY_VERSION,true),recordConsent('document_processing',LEGAL_VERSION,true)]);}
    catch(e){setSaving(false);setSaveError(net(e)?t.e_net:t.e_save);return;}
    try{await setServerEmail(email.trim());}
    catch(e){setSaving(false);if(e instanceof ApiError&&e.code==='email_taken')setErrors(x=>({...x,email:t.e_taken}));else setSaveError(net(e)?t.e_net:t.e_save);return;}
    try{await setPassword(pw);}
    catch(e){setSaving(false);if(e instanceof ApiError&&e.code==='weak_password')setErrors(x=>({...x,password:t.e_weak}));else setSaveError(net(e)?t.e_net:t.e_save);return;}
    try{await setServerName(name.trim());}catch{/* shown later in the profile */}
    setSaving(false);onSignedIn(mode==='register'?toE164(phone)??undefined:undefined);
  };

  const row={flexDirection:(ar?'row-reverse':'row') as 'row'|'row-reverse'};
  const align={textAlign:(ar?'right':'left') as 'right'|'left'};
  const sentence=(txt:string)=>`${t.agree} ${txt}`;
  const waiting=waBox&&!verified&&!!wa.challenge;
  return <AuthScaffold lang={lang} onLanguage={onLanguage} logo={logo} Text={T}
    title={mode==='complete'?t.completeTitle:t.registerTitle} subtitle={mode==='complete'?t.completeSub:t.registerSub2}
    footer={mode==='register'?<View style={[s.row,row]}><T lang={lang} style={s.muted}>{t.haveAccount}</T><TextLink tone="photo" lang={lang} Text={T} label={t.toLogin} onPress={onLogin}/></View>:null}>
    <View style={s.form}>
      <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.name} icon="user" value={name} onChangeText={v=>{setName(v);clear('name');}}
        placeholder={t.namePh} autoComplete="name" textContentType="name" maxLength={80} returnKeyType="next" error={errors.name}/>
      <RoundedField lang={lang} Text={T} label={t.email} icon="mail" value={email} onChangeText={v=>{setEmail(v);clear('email');}} ltr
        placeholder={t.emailPh} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" maxLength={120}
        hint={t.emailHint} error={errors.email}/>
      <PasswordField lang={lang} Text={T} label={t.password} value={pw} onChangeText={v=>{setPw(v);clear('password');}} error={errors.password} isNew/>

      {mode==='register'&&<View style={s.phoneBlock}>
        <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.phone} value={phone} onChangeText={v=>{setPhone(v);clear('phone');}} editable={!waBox&&!verified}
          placeholder={t.phonePh} keyboardType="phone-pad" ltr textContentType="telephoneNumber" autoComplete="tel" maxLength={16} error={errors.phone??(wa.error||null)}/>
        {verified
          ?<View style={[s.done,row]} accessibilityLiveRegion="polite"><Icon name="check" size={18} color="#B9F2CF"/><T lang={lang} style={[s.doneText,align]}>{t.waDone}</T></View>
          :<ConsentRow lang={lang} Text={T} checked={waBox} onToggle={toggleWa} label={t.waCheck}><T lang={lang} style={s.consentText}>{t.waCheck}</T></ConsentRow>}
        {!waBox&&!verified&&<T lang={lang} style={[s.hint,align]}>{t.waCheckHint}</T>}
        {waBox&&!verified&&<View style={s.waCard}>
          {wa.busy&&!wa.challenge?<ActivityIndicator color={authGlass.link}/>:null}
          {waiting&&<>
            <View style={[s.waStatus,row]} accessibilityLiveRegion="polite"><ActivityIndicator color={authGlass.link}/><T lang={lang} style={s.waStatusText}>{t.waSent}</T></View>
            <T lang={lang} style={[s.hint,align]}>{t.codeLabel}: {LRI}{wa.challenge!.code}{PDI}</T>
            {wa.stagingConfirm?<View style={s.staging}><T lang={lang} style={s.stagingNote}>{t.stagingNote}</T><PrimaryButton lang={lang} Text={T} label={t.stagingConfirm} onPress={wa.stagingConfirm}/></View>:null}
            <SecondaryButton lang={lang} Text={T} label={t.waAgain} onPress={wa.openWhatsApp}/>
          </>}
        </View>}
        {(waBox||verified)&&<View style={{alignItems:ar?'flex-end':'flex-start'}}><TextLink lang={lang} Text={T} label={t.changeNumber} onPress={changeNumber}/></View>}
        {verified&&existing?<T lang={lang} style={[s.hint,align]}>{t.existing}</T>:null}
      </View>}

      <View style={s.consents}>
        <ConsentRow lang={lang} Text={T} checked={terms} onToggle={()=>{setTerms(v=>!v);clear('consent');}} label={sentence(t.terms)}><T lang={lang} style={s.consentText}>{sentence(t.terms)}</T></ConsentRow>
        <ConsentRow lang={lang} Text={T} checked={privacy} onToggle={()=>{setPrivacy(v=>!v);clear('consent');}} label={sentence(t.privacy)}><T lang={lang} style={s.consentText}>{sentence(t.privacy)}</T></ConsentRow>
        <ConsentRow lang={lang} Text={T} checked={docs} onToggle={()=>{setDocs(v=>!v);clear('consent');}} label={t.docConsent}><T lang={lang} style={s.consentText}>{t.docConsent}</T></ConsentRow>
        <View style={[s.row,row]}>
          <TextLink lang={lang} Text={T} label={t.termsLink} onPress={()=>onLegal('terms')}/><TextLink lang={lang} Text={T} label={t.privacyLink} onPress={()=>onLegal('privacy')}/>
        </View>
        {errors.consent?<T lang={lang} style={s.error}>{errors.consent}</T>:null}
      </View>
      {saveError?<T lang={lang} style={s.error}>{saveError}</T>:null}
      <PrimaryButton lang={lang} Text={T} label={mode==='complete'?t.continue:t.createAccount} onPress={()=>void create()} busy={saving}/>
    </View>
  </AuthScaffold>;
}
const s=StyleSheet.create({
  form:{gap:space.lg},
  row:{alignItems:'center',gap:space.xs,flexWrap:'wrap'},
  muted:{fontSize:type.callout,color:glass.textSoft},
  phoneBlock:{gap:space.sm},
  hint:{fontSize:type.footnote,lineHeight:type.footnote*1.5,color:authGlass.soft},
  waCard:{gap:space.sm,padding:space.md,borderRadius:16,backgroundColor:authGlass.field,borderWidth:1,borderColor:authGlass.border},
  waStatus:{alignItems:'center',gap:space.sm},
  waStatusText:{fontSize:type.subhead,color:authGlass.text},
  done:{alignItems:'center',gap:space.sm,paddingVertical:space.sm,paddingHorizontal:space.md,borderRadius:14,backgroundColor:'rgba(143,227,176,0.16)',borderWidth:1,borderColor:'rgba(143,227,176,0.6)'},
  doneText:{flex:1,fontSize:type.subhead,fontWeight:'600',color:'#B9F2CF'},
  staging:{gap:space.sm,padding:space.md,borderRadius:16,borderWidth:1,borderStyle:'dashed',borderColor:'#B8893F',backgroundColor:'rgba(217,188,126,0.14)'},
  stagingNote:{fontSize:type.footnote,color:authGlass.text,textAlign:'center'},
  consents:{gap:space.xs},
  consentText:{fontSize:type.subhead,lineHeight:type.subhead*1.5,color:authGlass.text},
  error:{fontSize:type.footnote,color:authGlass.error,fontWeight:'600'},
});
