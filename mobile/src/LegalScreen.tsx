/**
 * Terms of Use / Privacy Policy — glass redesign. Shown as an overlay from sign-in, the request wizard and Account.
 * Fixed: it now owns the Android back button while open (the screen underneath used to receive it first).
 */
import React,{useEffect} from 'react';
import {BackHandler,StyleSheet,View} from 'react-native';
import {Txt} from './ui/Txt';
import {GlassCard,GlassScreen,ScreenHeader,Tag,g,rowFor,useReduceTransparency} from './ui/Glass';
import {colors,space,type} from './theme';
import {COMPANY,LEGAL_VERSION,type LegalDoc} from './legal';
import {tr} from './i18n';

type Language=import('./i18n').Lang;
type Props={lang:Language;doc:LegalDoc;onBack:()=>void};

export function LegalScreen({lang,doc,onBack}:Props){
  const ar=lang==='ar';
  const reduce=useReduceTransparency();
  // Registered after the screens underneath, so the system back button closes this overlay first.
  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true});return ()=>sub.remove()},[onBack]);
  return <GlassScreen>
    <ScreenHeader lang={lang} title={tr(doc.title,lang)} backLabel={ar?'رجوع':'Back'} onBack={onBack}/>
    <View style={[styles.meta,{flexDirection:rowFor(lang)}]}>
      <Tag lang={lang}>{ar?'مسودة بانتظار المراجعة القانونية':'Draft pending legal review'}</Tag>
      <Txt lang={lang} style={g.meta}>{`${tr(COMPANY.name,lang)} · ${tr(COMPANY.city,lang)} · `}{'⁦'+LEGAL_VERSION+'⁩'}</Txt>
    </View>
    <GlassCard reduce={reduce}><Txt lang={lang} style={styles.p}>{tr(doc.intro,lang)}</Txt></GlassCard>
    {doc.sections.map((x,i)=><GlassCard key={i} reduce={reduce}>
      <View style={styles.section}>
        <View accessibilityRole="header"><Txt lang={lang} bold style={styles.h}>{tr(x.h,lang)}</Txt></View>
        <Txt lang={lang} style={styles.p}>{tr(x.p,lang)}</Txt>
      </View>
    </GlassCard>)}
  </GlassScreen>;
}

const styles=StyleSheet.create({
  meta:{flexWrap:'wrap',alignItems:'center',gap:space.sm},
  section:{gap:space.sm},
  h:{fontSize:type.headline,lineHeight:26,color:colors.ink},
  p:{fontSize:type.subhead,lineHeight:26,color:'#2B3448'},
});
