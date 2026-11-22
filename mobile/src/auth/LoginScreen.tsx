import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {authCopy,type Lang} from './copy';
import {PHONE_PREFIX,toE164} from './phone';
import {AuthScaffold,PrimaryButton,RoundedField,SecondaryButton,StepTransition,TextLink,type AuthText,AText} from './AuthKit';
import {WaitingStep} from './WaitingStep';
import {useWaVerification} from './useWaVerification';
import {glass,onGlass,space,type} from '../theme';
import {pick} from '../i18n';

type Props={
  lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;inputFont?:string;
  onVerified:(info:{isNewUser:boolean;phone:string})=>void;onRegister:()=>void;onGuest:()=>void;onLegal:(k:'terms'|'privacy')=>void;
};

/** Sign in: mobile number → WhatsApp confirmation → session. No password exists in this product. */
export function LoginScreen({lang,onLanguage,logo,inputFont,onVerified,onRegister,onGuest,onLegal}:Props){
  const t=pick(authCopy,lang);
  const T=AText;
  const [phone,setPhone]=useState(PHONE_PREFIX);
  const [fieldError,setFieldError]=useState<string|null>(null);
  const wa=useWaVerification(lang,onVerified);
  const submit=()=>{const p=toE164(phone);if(!p){setFieldError(t.e_phone);return;}setFieldError(null);void wa.start(p);};
  const waiting=!!wa.challenge;
  return <AuthScaffold lang={lang} onLanguage={onLanguage} logo={logo} title={waiting?t.waitTitle:t.loginTitle} subtitle={waiting?t.waitSub:t.loginSub}
    footer={waiting?null:<>
      <View style={[s.row,{flexDirection:lang==='ar'?'row-reverse':'row'}]}><T lang={lang} style={s.muted}>{t.noAccount}</T><TextLink tone="photo" lang={lang} Text={T} label={t.toRegister} onPress={onRegister}/></View>
      <TextLink tone="photo" lang={lang} Text={T} label={t.guest} onPress={onGuest}/>
    </>}>
    <StepTransition stepKey={waiting?'wait':'form'}>
      {waiting
        ?<WaitingStep lang={lang} Text={T} code={wa.challenge?.code} expiresAt={wa.challenge?.expiresAt} error={wa.error} onOpen={wa.openWhatsApp} onStagingConfirm={wa.stagingConfirm} onCancel={wa.cancel}/>
        :<View style={s.form}>
          <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.phone} value={phone} onChangeText={v=>{setPhone(v);if(fieldError)setFieldError(null);}}
            placeholder={t.phonePh} keyboardType="phone-pad" ltr textContentType="telephoneNumber" autoComplete="tel" maxLength={16} returnKeyType="go" onSubmitEditing={submit}
            error={fieldError??(wa.error||null)}/>
          <PrimaryButton lang={lang} Text={T} label={t.verify} onPress={submit} busy={wa.busy}/>
          <T lang={lang} style={[s.notice,{textAlign:lang==='ar'?'right':'left'}]}>{t.loginNotice} {t.terms} {t.and} {t.privacy}</T>
          <View style={[s.legalRow,{flexDirection:lang==='ar'?'row-reverse':'row'}]}>
            <SecondaryButton lang={lang} Text={T} label={t.termsLink} onPress={()=>onLegal('terms')}/>
            <SecondaryButton lang={lang} Text={T} label={t.privacyLink} onPress={()=>onLegal('privacy')}/>
          </View>
        </View>}
    </StepTransition>
  </AuthScaffold>;
}
const s=StyleSheet.create({
  form:{gap:space.lg},
  row:{alignItems:'center',gap:space.xs},
  muted:{fontSize:type.callout,color:glass.textSoft},
  notice:{fontSize:type.footnote,color:onGlass.soft,lineHeight:type.footnote*1.5},
  legalRow:{gap:space.sm},
});
