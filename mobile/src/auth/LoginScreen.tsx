import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {ApiError,passwordLogin,setPassword} from '../api';
import {authCopy,type Lang} from './copy';
import {e164From,isEmail} from './phone';
import {PhoneField} from './PhoneField';
import {DEFAULT_COUNTRY} from './countries';
import {AuthScaffold,PrimaryButton,RoundedField,SecondaryButton,StepTransition,TextLink,type AuthText,AText} from './AuthKit';
import {PasswordField} from './PasswordField';
import {WaitingStep} from './WaitingStep';
import {useWaVerification} from './useWaVerification';
import {glass,authGlass,space,type} from '../theme';
import {pick} from '../i18n';

type Props={
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;inputFont?:string;
  /** Signed in. isNewUser: the number confirmed in "forgot password" had no account yet (finish registration). */
  onVerified:(info:{isNewUser:boolean;phone?:string})=>void;onRegister:()=>void;onLegal:(k:'terms'|'privacy')=>void;
};
type Step='password'|'forgot'|'newpass';

/**
 * Sign in with email and password. "Forgot password?" confirms the mobile number on WhatsApp (the customer sends one ready-made
 * message), which signs the person in, and then asks for a new password.
 */
export function LoginScreen({lang,onLanguage,logo,inputFont,onVerified,onRegister,onLegal}:Props){
  const t=pick(authCopy,lang);
  const T=AText;
  const [step,setStep]=useState<Step>('password');
  const [email,setEmail]=useState('');const [password,setPw]=useState('');
  const [phone,setPhone]=useState('');const [cc,setCc]=useState({iso:DEFAULT_COUNTRY.iso,dial:DEFAULT_COUNTRY.dial}); /* country code + local number */const [newPw,setNewPw]=useState('');
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const [verifiedPhone,setVerifiedPhone]=useState<string|undefined>(undefined);
  const wa=useWaVerification(lang,info=>{if(info.isNewUser){onVerified(info);return;}setVerifiedPhone(info.phone);setStep('newpass');setError(null);});
  const fail=(e:unknown)=>{const c=e instanceof ApiError?e.code:'';setError(c==='invalid_credentials'?t.e_cred:c==='weak_password'?t.e_weak:c==='too_many_requests'?t.e_many:c==='network'?t.e_net:t.e_gen);};

  const signIn=async()=>{
    if(!isEmail(email)){setError(t.e_email);return;}
    if(!password){setError(t.e_cred);return;}
    setBusy(true);setError(null);
    try{await passwordLogin(email,password);onVerified({isNewUser:false});}catch(e){fail(e);}finally{setBusy(false);}
  };
  const confirmNumber=()=>{const p=e164From(cc.dial,phone);if(!p){setError(t.e_phone);return;}setError(null);void wa.start(p,{open:true});};
  const saveNew=async()=>{
    setBusy(true);setError(null);
    try{await setPassword(newPw);onVerified({isNewUser:false,phone:verifiedPhone});}catch(e){fail(e);}finally{setBusy(false);}
  };

  const waiting=step==='forgot'&&!!wa.challenge;
  const title=step==='password'?t.loginTitle:step==='newpass'?t.newPassTitle:waiting?t.waitTitle:t.forgotTitle;
  const subtitle=step==='password'?t.loginSub2:step==='newpass'?t.newPassSub:waiting?t.waitSub:t.forgotSub;
  const back=()=>{wa.cancel();setStep('password');setError(null);};
  return <AuthScaffold lang={lang} onLanguage={onLanguage} logo={logo} title={title} subtitle={subtitle}
    footer={step!=='password'?null:<>
      <View style={[s.row,{flexDirection:lang==='ar'?'row-reverse':'row'}]}><T lang={lang} style={s.muted}>{t.noAccount}</T><TextLink tone="photo" lang={lang} Text={T} label={t.toRegister} onPress={onRegister}/></View>
    </>}>
    <StepTransition stepKey={waiting?'wait':step}>
      {step==='password'?<View style={s.form}>
          <RoundedField lang={lang} Text={T} label={t.email} icon="mail" value={email} onChangeText={v=>{setEmail(v);setError(null);}} ltr
            placeholder={t.emailPh} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="email" maxLength={120} returnKeyType="next"/>
          <PasswordField lang={lang} Text={T} label={t.password} value={password} onChangeText={v=>{setPw(v);setError(null);}} error={error} onSubmitEditing={()=>void signIn()}/>
          <View style={{alignItems:lang==='ar'?'flex-start':'flex-end'}}><TextLink lang={lang} Text={T} label={t.forgot} onPress={()=>{setStep('forgot');setError(null);}}/></View>
          <PrimaryButton lang={lang} Text={T} label={t.signIn} onPress={()=>void signIn()} busy={busy}/>
          <T lang={lang} style={[s.notice,{textAlign:lang==='ar'?'right':'left'}]}>{t.loginNotice} {t.terms} {t.and} {t.privacy}</T>
          <View style={[s.legalRow,{flexDirection:lang==='ar'?'row-reverse':'row'}]}>
            <SecondaryButton lang={lang} Text={T} label={t.termsLink} onPress={()=>onLegal('terms')}/>
            <SecondaryButton lang={lang} Text={T} label={t.privacyLink} onPress={()=>onLegal('privacy')}/>
          </View>
        </View>
      :step==='newpass'?<View style={s.form}>
          <PasswordField lang={lang} Text={T} label={t.password} value={newPw} onChangeText={v=>{setNewPw(v);setError(null);}} error={error} isNew onSubmitEditing={()=>void saveNew()}/>
          <PrimaryButton lang={lang} Text={T} label={t.savePass} onPress={()=>void saveNew()} busy={busy}/>
        </View>
      :waiting?<WaitingStep lang={lang} Text={T} code={wa.challenge?.code} expiresAt={wa.challenge?.expiresAt} error={wa.error} onOpen={wa.openWhatsApp} onStagingConfirm={wa.stagingConfirm} onCancel={()=>wa.cancel()}/>
      :<View style={s.form}>
          <PhoneField lang={lang} Text={T} label={t.phone} iso={cc.iso} dial={cc.dial} local={phone} onChange={v=>{setCc({iso:v.iso,dial:v.dial});setPhone(v.local);setError(null);}} error={error??(wa.error||null)}/>
          <PrimaryButton lang={lang} Text={T} label={t.confirmWa} onPress={confirmNumber} busy={wa.busy}/>
          <SecondaryButton lang={lang} Text={T} label={t.backToLogin} onPress={back}/>
        </View>}
    </StepTransition>
  </AuthScaffold>;
}
const s=StyleSheet.create({
  form:{gap:space.lg},
  row:{alignItems:'center',gap:space.xs},
  muted:{fontSize:type.callout,color:glass.textSoft},
  notice:{fontSize:type.footnote,color:authGlass.soft,lineHeight:type.footnote*1.5},
  legalRow:{gap:space.sm},
});
