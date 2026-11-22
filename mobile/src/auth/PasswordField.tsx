import React,{useState} from 'react';
import {StyleSheet} from 'react-native';
import {Icon} from '../Icons';
import {ScalePressable} from '../ui/Premium';
import {RoundedField,type AuthText} from './AuthKit';
import {authCopy,type Lang} from './copy';
import {authGlass,layout} from '../theme';
import {pick} from '../i18n';

/** Password input with a show/hide button. `isNew` asks the keyboard/password manager for a new password. */
export function PasswordField({lang,Text,label,value,onChangeText,error,hint,isNew=false,onSubmitEditing}:{lang:Lang;Text?:AuthText;label:string;value:string;onChangeText:(v:string)=>void;error?:string|null;hint?:string;isNew?:boolean;onSubmitEditing?:()=>void}){
  const t=pick(authCopy,lang);
  const [shown,setShown]=useState(false);
  return <RoundedField lang={lang} Text={Text} label={label} icon="lock" value={value} onChangeText={onChangeText} ltr
    secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} maxLength={128}
    textContentType={isNew?'newPassword':'password'} autoComplete={isNew?'new-password':'current-password'} passwordRules={isNew?'minlength: 8; required: lower; required: digit;':undefined}
    placeholder={isNew?t.passwordPh:undefined} returnKeyType="go" onSubmitEditing={onSubmitEditing} error={error??undefined} hint={hint}
    trailing={<ScalePressable accessibilityRole="button" accessibilityLabel={shown?t.hidePw:t.showPw} onPress={()=>setShown(v=>!v)} style={s.eye} rippleColor="rgba(14,21,38,0.12)">
      <Icon name={shown?'eyeOff':'eye'} size={20} color={authGlass.soft}/>
    </ScalePressable>}/>;
}
const s=StyleSheet.create({eye:{width:layout.minTouch,height:layout.minTouch,alignItems:'center',justifyContent:'center',borderRadius:22}});
