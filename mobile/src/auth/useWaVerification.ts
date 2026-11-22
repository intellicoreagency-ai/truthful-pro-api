import {useCallback,useEffect,useRef,useState} from 'react';
import {Linking} from 'react-native';
import {ApiError,waPoll,waStagingConfirm,waStart,type WaChallenge} from './../api';
import {authCopy,type Lang} from './copy';
import {pick} from '../i18n';

/**
 * Passwordless sign-in: the app shows the code and the steps; the user opens WhatsApp (only when they tap the button) and sends
 * the ready-made message (free for them); the server verifies the signed webhook and we poll until it says "verified", then sign in
 * automatically. The session tokens are saved by the API client in expo-secure-store (Keychain / Keystore).
 */
export function useWaVerification(lang:Lang,onVerified:(info:{isNewUser:boolean;phone:string})=>void){
  const t=pick(authCopy,lang);
  const [challenge,setChallenge]=useState<(WaChallenge&{phone:string;expiresAt:number})|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const alive=useRef(true);
  const done=useRef(onVerified);done.current=onVerified;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);

  const message=useCallback((e:unknown)=>{
    const c=e instanceof ApiError?e.code:'';
    return c==='too_many_requests'?t.e_many:c==='not_configured'?t.e_notcfg:c==='invalid_phone'?t.e_phone:c==='network'?t.e_net:t.e_gen;
  },[t]);

  /** open: also open WhatsApp right away (the person just asked for it, e.g. by ticking the WhatsApp box). */
  const start=useCallback(async(phone:string,opts:{open?:boolean}={})=>{
    setError('');setBusy(true);
    try{const c=await waStart(phone,lang); /* the ready-made WhatsApp message is written in the app language */setChallenge({...c,phone,expiresAt:Date.now()+c.expiresIn*1000});if(opts.open&&!c.stagingConfirm)void Linking.openURL(c.link).catch(()=>{});}
    catch(e){setError(message(e));}
    finally{if(alive.current)setBusy(false);}
  },[lang,message]);

  const cancel=useCallback(()=>{setChallenge(null);setError('');},[]);
  /** STAGING ONLY (offered by the server to listed testers): confirm without WhatsApp; the normal polling then signs in. */
  const stagingConfirm=useCallback(()=>{if(challenge?.stagingConfirm)void waStagingConfirm(challenge.phone,challenge).catch(e=>setError(message(e)));},[challenge,message]);
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

  return {challenge,busy,error,setError,start,cancel,openWhatsApp,stagingConfirm:challenge?.stagingConfirm?stagingConfirm:undefined};
}
