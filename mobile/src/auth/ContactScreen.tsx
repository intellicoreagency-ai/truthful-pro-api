import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {ApiError,setServerEmail} from '../api';
import {authCopy,type Lang} from './copy';
import {isEmail} from './phone';
import {AuthScaffold,PrimaryButton,RoundedField,SecondaryButton,StepTransition,type AuthText,AText} from './AuthKit';
import {space} from '../theme';
import {pick} from '../i18n';

/** Shown to a signed-in customer whose account has no email yet (older accounts): the email is essential contact data. */
export function ContactScreen({lang,onLanguage,logo,inputFont,onDone,onSignOut}:{lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text?:AuthText;inputFont?:string;onDone:()=>void;onSignOut:()=>void}){
  const t=pick(authCopy,lang);
  const T=AText;
  const [email,setEmail]=useState('');const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(!email.trim()){setError(t.e_email_req);return;}
    if(!isEmail(email)){setError(t.e_email);return;}
    setBusy(true);setError(null);
    try{await setServerEmail(email.trim());onDone();}
    catch(e){setError(e instanceof ApiError&&e.code==='network'?t.e_net:e instanceof ApiError&&e.code==='invalid_email'?t.e_email:t.e_gen);}
    finally{setBusy(false);}
  };
  return <AuthScaffold lang={lang} onLanguage={onLanguage} logo={logo} Text={T} title={t.contactTitle} subtitle={t.contactSub}>
    <StepTransition stepKey="contact">
      <View style={s.form}>
        <RoundedField lang={lang} Text={T} inputFont={inputFont} label={t.email} icon="mail" value={email} onChangeText={v=>{setEmail(v);setError(null);}} placeholder={t.emailPh}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" maxLength={120} returnKeyType="done" onSubmitEditing={()=>void submit()}
          hint={t.emailHint} error={error}/>
        <PrimaryButton lang={lang} Text={T} label={t.save} onPress={()=>void submit()} busy={busy}/>
        <SecondaryButton lang={lang} Text={T} label={t.signOut} onPress={onSignOut}/>
      </View>
    </StepTransition>
  </AuthScaffold>;
}
const s=StyleSheet.create({form:{gap:space.lg}});
