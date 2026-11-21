/**
 * Fallback — shown only if the app lands on "start request" without a chosen transaction
 * (e.g. a saved draft whose transaction no longer exists). Replaces the legacy `simplePage`.
 */
import React from 'react';
import {StyleSheet,View} from 'react-native';
import {Icon} from './Icons';
import {Txt,type Lang} from './ui/Txt';
import {GlassButton,GlassCard,GlassScreen,ScreenHeader,g,useReduceTransparency} from './ui/Glass';
import {colors,space} from './theme';
import {pick} from './i18n';

const COPY={
  ar:{title:'بدء معاملة',body:'اختر الخدمة ثم المعاملة المطلوبة لبدء طلبك.',action:'تصفح الخدمات'},
  en:{title:'Start Request',body:'Choose a service, then the transaction you need, to start your request.',action:'Browse services'},
} as const;

export function FallbackScreen({lang,onServices}:{lang:Lang;onServices:()=>void}){
  const t=pick(COPY,lang);
  const reduce=useReduceTransparency();
  return <GlassScreen>
    <ScreenHeader lang={lang} title={t.title}/>
    <GlassCard reduce={reduce}>
      <View style={styles.center}>
        <Icon name="grid" size={36} color={colors.brand}/>
        <Txt lang={lang} style={{...g.body,textAlign:'center'}}>{t.body}</Txt>
      </View>
      <GlassButton lang={lang} primary icon="grid" label={t.action} onPress={onServices}/>
    </GlassCard>
  </GlassScreen>;
}

const styles=StyleSheet.create({center:{alignItems:'center',gap:space.sm,paddingVertical:space.sm}});
