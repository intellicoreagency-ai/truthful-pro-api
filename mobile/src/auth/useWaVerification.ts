import {useCallback,useEffect,useRef,useState} from 'react';
import {Linking} from 'react-native';
import {ApiError,waPoll,waStart,type WaChallenge} from './../api';
import {authCopy,type Lang} from './copy';
import {apiLang,pick} from '../i18n';

/**
 * Passwordless sign-in: the user sends a ready-made WhatsApp message (free for them); the server verifies the signed webhook and
 * we poll until it says "verified". The session tokens are saved by the API client in expo-secure-store (Keychain / Keystore).
 */
export function useWaVerification(lang:Lang,onVerified:(info:{isNewUser:boolean;phone:string})=>void){
  const t=pick(authCopy,lang);
  const [challenge,setChallenge]=useState<(WaChallenge&{phone:string})|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const alive=useRef(true);
  const done=useRef(onVerified);done.current=onVerified;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);

  const message=useCallback((e:unknown)=>{
    const c=e instanceof ApiError?e.code:'';
    return c==='too_many_requests'?t.e_many:c==='not_configured'?t.e_notcfg:c==='invalid_phone'?t.e_phone:c==='network'?t.e_net:t.e_gen;
  },[t]);

  const start=useCallback(async(phone:string)=>{
    setError('');setBusy(true);
    try{const c=await waStart(phone,apiLang(lang));setChallenge({...c,phone});void Linking.openURL(c.link).catch(()=>{});}
    catch(e){setError(message(e));}
    finally{if(alive.current)setBusy(false);}
  },[lang,message]);

  const cancel=useCallback(()=>{setChallenge(null);setError('');},[]);
  const openWhatsApp=useCallback(()=>{if(challenge)void Linking.openURL(challenge.link).catch(()=>{});},[challenge]);

  useEffect(()=>{
    if(!challenge)return;
    let stop=false;let timer:ReturnType<typeof setTimeout>;
    const until=Date.now()+challenge.expiresIn*1000;
    const tick=async()=>{
      if(stop||!alive.current)return;
      try{
        const r=await waPoll(challenge.phone,challenge);
        if(r.status==='verified'){stop=true;if(alive.current)done.current({isNewUser:!!r.isNewUser,phone:challenge.phone});return;}
        if(r.status==='expired'||Date.now()>until){stop=true;if(alive.current){setChallenge(null);setError(t.e_expired);}return;}
      }catch(e){
        if(e instanceof ApiError&&e.status>=400&&e.status<500&&e.status!==429){stop=true;if(alive.current){setChallenge(null);setError(message(e));}return;}
      }
      if(!stop)timer=setTimeout(tick,2000);
    };
    timer=setTimeout(tick,2000);
    return()=>{stop=true;clearTimeout(timer);};
  },[challenge,t,message]);

  return {challenge,busy,error,setError,start,cancel,openWhatsApp};
}
