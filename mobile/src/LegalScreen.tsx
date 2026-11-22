/**
 * Terms of Use / Privacy Policy — glass redesign. Shown as an overlay from sign-in, the request wizard and Account.
 * Fixed: it now owns the Android back button while open (the screen underneath used to receive it first).
 */
import React,{useEffect} from 'react';
import {BackHandler,StyleSheet,View} from 'react-native';
import {Txt} from './ui/Txt';
import {GlassCard,GlassScreen,ScreenHeader,Tag,g,rowFor,useReduceTransparency} from './ui/Glass';
import {colors,space,type} from './theme';
import {COMPANY,type LegalDoc} from './legal';
import {COMMON,tr} from './i18n';

const DRAFT:Record<Language,string>={ar:'مسودة بانتظار المراجعة القانونية',en:'Draft pending legal review',ru:'Проект, ожидает юридической проверки',zh:'草稿，待法律审阅',fr:'Projet en attente de validation juridique',es:'Borrador pendiente de revisión legal'};
/** Shown above translated documents: only the Arabic and English texts are binding. */
const PREVAILS:Partial<Record<Language,string>>={
  ru:'Перевод предоставлен для информации. Юридическую силу имеют только тексты на арабском и английском языках; при расхождении они имеют преимущество.',
  zh:'本译文仅供参考。只有阿拉伯语和英语文本具有法律效力；如有歧义，以其为准。',
  fr:'Traduction fournie à titre informatif. Seules les versions arabe et anglaise font foi ; en cas de divergence, elles prévalent.',
  es:'Traducción meramente informativa. Solo los textos en árabe e inglés son vinculantes y prevalecen en caso de discrepancia.'};

type Language=import('./i18n').Lang;
type Props={lang:Language;doc:LegalDoc;onBack:()=>void};

export function LegalScreen({lang,doc,onBack}:Props){
  const reduce=useReduceTransparency();
  // Registered after the screens underneath, so the system back button closes this overlay first.
  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true});return ()=>sub.remove()},[onBack]);
  return <GlassScreen>
    <ScreenHeader lang={lang} title={tr(doc.title,lang)} backLabel={COMMON[lang].back} onBack={onBack}/>
    <View style={[styles.meta,{flexDirection:rowFor(lang)}]}>
      {doc.version.startsWith('draft')&&<Tag lang={lang}>{DRAFT[lang]}</Tag>}
      <Txt lang={lang} style={g.meta}>{`${tr(COMPANY.name,lang)} · ${tr(COMPANY.city,lang)} · `}{'⁦'+doc.version+'⁩'}</Txt>
    </View>
    {PREVAILS[lang]?<View style={styles.notice} accessibilityRole="text"><Txt lang={lang} bold style={styles.noticeText}>{PREVAILS[lang]}</Txt></View>:null}
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
  notice:{borderRadius:14,borderWidth:1,borderColor:'rgba(184,137,63,0.45)',backgroundColor:'rgba(217,188,126,0.14)',paddingVertical:space.md,paddingHorizontal:space.lg},
  noticeText:{fontSize:type.footnote,lineHeight:20,color:colors.ink},
  h:{fontSize:type.headline,lineHeight:26,color:colors.ink},
  p:{fontSize:type.subhead,lineHeight:26,color:'#2B3448'},
});
