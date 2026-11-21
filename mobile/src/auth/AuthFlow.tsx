import React,{useEffect,useState} from 'react';
import {BackHandler,StyleSheet,View} from 'react-native';
import {colors} from '../theme';
import type {AuthText} from './AuthKit';
import {LoginScreen} from './LoginScreen';
import {RegisterScreen} from './RegisterScreen';
import {ContactScreen} from './ContactScreen';
import {logout,me} from '../api';
import type {Lang} from './copy';

type Props={lang:Lang;onLanguage:(l:Lang)=>void;logo:number;Text:AuthText;inputFont:string;onGuest:()=>void;onSignedIn:()=>void;onLegal:(k:'terms'|'privacy')=>void};
type Screen='login'|'register'|'complete'|'contact';

/** Root of the signed-out experience. Back: register → login; everything else lets the system handle it (exit). */
export function AuthFlow(p:Props){
  const [screen,setScreen]=useState<Screen>('login');
  useEffect(()=>{
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(screen==='register'){setScreen('login');return true;}return false;});
    return()=>sub.remove();
  },[screen]);
  return <View style={s.fill}>
    {screen==='login'
      ?<LoginScreen lang={p.lang} onLanguage={p.onLanguage} logo={p.logo} Text={p.Text} inputFont={p.inputFont}
          // a number with no account yet: finish registration (name + consents) before entering the app
          onVerified={info=>{if(info.isNewUser){setScreen('complete');return;}
            // existing account: the email is essential contact data, so an account without one adds it before entering
            void me().then(r=>r.user.email_set===false?setScreen('contact'):p.onSignedIn()).catch(()=>p.onSignedIn());}}
          onRegister={()=>setScreen('register')} onGuest={p.onGuest} onLegal={p.onLegal}/>
      :screen==='contact'
      ?<ContactScreen lang={p.lang} onLanguage={p.onLanguage} logo={p.logo} Text={p.Text} inputFont={p.inputFont} onDone={p.onSignedIn} onSignOut={()=>{void logout().finally(()=>setScreen('login'))}}/>
      :<RegisterScreen lang={p.lang} onLanguage={p.onLanguage} logo={p.logo} Text={p.Text} inputFont={p.inputFont}
          mode={screen==='complete'?'complete':'register'} onSignedIn={p.onSignedIn} onLogin={()=>setScreen('login')} onLegal={p.onLegal}/>}
  </View>;
}
const s=StyleSheet.create({fill:{flex:1,backgroundColor:colors.background}});
