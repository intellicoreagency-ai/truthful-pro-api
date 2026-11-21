import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {ApiError,recordConsent,setServerEmail,setServerName} from '../api';
import {LEGAL_VERSION} from '../legal';
import {authCopy,type Lang} from './copy';
import {isEmail,toE164} from './phone';
import {AuthScaffold,ConsentRow,PrimaryButton,RoundedField,StepTransition,TextLink,type AuthText,AText} from './AuthKit';
import {WaitingStep} from './WaitingStep';
import {useWaVerification} from './useWaVerification';
import {glass,space,type} from '../theme';

type Props={
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;inputFont?:string;
  /** 'register' = full form incl. phone; 'complete' = a first-time sign-in from the login screen (phone already verified). */
  mode:'register'|'complete';
  onSignedIn:()=>void;onLogin:()=>void;onLegal:(k:'terms'|'privacy')=>void;
};

/**
 * Create account: name, mobile, email (required), consents → WhatsApp confirmation → consents/name/email saved → signed in.
 * The three consents are recorded with the legal version after the session exists; if saving fails the user can retry.
 */
export function RegisterScreen({lang,onLanguage,logo,inputFont,mode,onSignedIn,onLogin,onLegal}:Props){
  const t=authCopy[lang];
  const T=AText;
  const [name,setName]=useState('');const [phone,setPhone]=useState('');const [email,setEmail]=useState('');
  const [terms,setTerms]=useState(false);const [privacy,setPrivacy]=useState(false);const [docs,setDocs]=useState(false);
  const [errors,setErrors]=useState<{name?:string;phone?:string;email?:string;consent?:string}>({});
  const [saveError,setSaveError]=useState('');const [saving,setSaving]=useState(false);const [verified,setVerified]=useState(false);

  /** After the session exists: consents and email are required (retry on failure); the name is best effort. */
  const finish=async()=>{
    setSaving(true);setSaveError('');
    try{
      await Promise.all([recordConsent('terms',LEGAL_VERSION,true),recordConsent('privacy',LEGAL_VERSION,true),recordConsent('document_processing',LEGAL_VERSION,true)]);
    }catch(e){setSaving(false);setSaveError(e instanceof ApiError&&e.code==='network'?t.e_net:t.e_save);return;}
    try{if(name.trim())await setServerName(name.trim());}catch{/* shown later in the profile */}
    try{await setServerEmail(email.trim());}catch(e){setSaving(false);setSaveError(e instanceof ApiError&&e.code==='network'?t.e_net:t.e_save);return;} // the email is essential contact data
    setSaving(false);onSignedIn();
  };
  const wa=useWaVerification(lang,()=>{setVerified(true);void finish();});

  const validate=()=>{
    const e:typeof errors={};
    if(name.trim().length<2)e.name=t.e_name;
    if(mode==='register'&&!toE164(phone))e.phone=t.e_phone;
    if(!email.trim())e.email=t.e_email_req;else if(!isEmail(email))e.email=t.e_email;
    if(!terms||!privacy||!docs)e.consent=t.e_consent;
    setErrors(e);return Object.keys(e).length===0;
  };
  const submit=()=>{
    if(!validate())return;
    if(mode==='complete'){setVerified(true);void finish();return;} // already verified at the login screen
    void wa.start(toE164(phone) as string);
  };
  const waiting=!!wa.challenge||verified;
  const sentence=(txt:string,link?:'terms'|'privacy')=>link?`${t.agree} ${txt}`:txt;
  return <AuthScaffold lang={lang} onLanguage={onLanguage} logo={logo} Text={T}
    title={waiting?(verified?t.completeTitle:t.waitTitle):mode==='complete'?t.completeTitle:t.registerTitle}
    subtitle={waiting?(verified?'':t.waitSub):mode==='complete'?t.completeSub:t.registerSub}
    footer={waiting?null:mode==='register'?<View style={[s.row,{flexDirection:lang==='ar'?'row-reverse':'row'}]}><T lang={lang} style={s.muted}>{t.haveAccount}</T><TextLink lang={lang} Text={T} label={t.toLogin} onPress={onLogin}/></View>:null}>
    <StepTransition stepKey={waiting?'wait':'form'}>
      {waiting
        ?<WaitingStep lang={lang} Text={T} error={saveError||wa.error} onOpen={wa.openWhatsApp} onCancel={()=>{wa.cancel();setVerified(false);setSaveError('');}} onRetry={verified&&!saving?()=>void finish():undefined}/>
        :<View style={s.form}>
          <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.name} icon="user" value={name} onChangeText={v=>{setName(v);setErrors(x=>({...x,name:undefined}));}}
            placeholder={t.namePh} autoComplete="name" textContentType="name" maxLength={80} returnKeyType="next" error={errors.name}/>
          {mode==='register'?<RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.phone} value={phone} onChangeText={v=>{setPhone(v);setErrors(x=>({...x,phone:undefined}));}}
            placeholder={t.phonePh} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={16} error={errors.phone??(wa.error||null)}/>:null}
          <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.email} icon="mail" value={email} onChangeText={v=>{setEmail(v);setErrors(x=>({...x,email:undefined}));}}
            placeholder={t.emailPh} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" maxLength={120}
            hint={t.emailHint} error={errors.email}/>
          <View style={s.consents}>
            <ConsentRow lang={lang} Text={T} checked={terms} onToggle={()=>setTerms(v=>!v)} label={sentence(t.terms,'terms')}><T lang={lang} style={s.consentText}>{sentence(t.terms,'terms')}</T></ConsentRow>
            <ConsentRow lang={lang} Text={T} checked={privacy} onToggle={()=>setPrivacy(v=>!v)} label={sentence(t.privacy,'privacy')}><T lang={lang} style={s.consentText}>{sentence(t.privacy,'privacy')}</T></ConsentRow>
            <ConsentRow lang={lang} Text={T} checked={docs} onToggle={()=>setDocs(v=>!v)} label={t.docConsent}><T lang={lang} style={s.consentText}>{t.docConsent}</T></ConsentRow>
            <View style={[s.row,{flexDirection:lang==='ar'?'row-reverse':'row'}]}>
              <TextLink lang={lang} Text={T} label={t.terms} onPress={()=>onLegal('terms')}/><TextLink lang={lang} Text={T} label={t.privacy} onPress={()=>onLegal('privacy')}/>
            </View>
            {errors.consent?<T lang={lang} style={s.error}>{errors.consent}</T>:null}
          </View>
          <PrimaryButton lang={lang} Text={T} label={mode==='complete'?t.continue:t.verify} onPress={submit} busy={wa.busy||saving}/>
        </View>}
    </StepTransition>
  </AuthScaffold>;
}
const s=StyleSheet.create({
  form:{gap:space.lg},
  row:{alignItems:'center',gap:space.xs,flexWrap:'wrap'},
  muted:{fontSize:type.callout,color:glass.textSoft},
  consents:{gap:space.xs},
  consentText:{fontSize:type.subhead,lineHeight:type.subhead*1.5,color:glass.text},
  error:{fontSize:type.footnote,color:glass.error},
});
