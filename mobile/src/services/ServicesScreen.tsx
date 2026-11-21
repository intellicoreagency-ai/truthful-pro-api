/**
 * Services catalogue — glass redesign (replaces `cataloguePage` in App.tsx).
 * Audience switch (individuals / companies), search, and the approved service banners as tiles.
 * Banners are rendered by App (`renderBanner`) so the approved artwork and its rules stay in one place.
 */
import React from 'react';
import {Image,Platform,StyleSheet,TextInput,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {officialLogo} from '../ReferenceUI';
import {Txt,type Lang} from '../ui/Txt';
import {GlassScreen,Note,SectionTitle,g,rowFor} from '../ui/Glass';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {serviceLabel,type Service} from '../services';

const COPY={
  ar:{brand:'تروثفل برو',tagline:'خدمات تخليص المعاملات',languageA11y:'التبديل إلى الإنجليزية',profile:'حسابي',
    individual:'الأفراد',company:'الشركات',audience:'نوع الخدمات',search:'ابحث عن خدمة أو معاملة...',clear:'مسح البحث',
    individualTitle:'خدمات الأفراد',companyTitle:'خدمات الشركات',choose:'اختر الخدمة',
    count:(n:number)=>`${n} خدمة`,none:'لم نجد خدمة مطابقة.',noneHint:'جرّب كلمة أخرى أو انتقل إلى خدمات {other}.'},
  en:{brand:'TRUTHFUL PRO',tagline:'Document clearance services',languageA11y:'Switch to Arabic',profile:'My Account',
    individual:'Individuals',company:'Companies',audience:'Service type',search:'Search for a service...',clear:'Clear search',
    individualTitle:'Individual Services',companyTitle:'Company Services',choose:'Choose service',
    count:(n:number)=>`${n} service${n===1?'':'s'}`,none:'No matching services.',noneHint:'Try another word or switch to {other}.'},
} as const;

type Props={
  lang:Lang;business:boolean;onAudience:(business:boolean)=>void;query:string;onQuery:(q:string)=>void;
  services:Service[];choosing:boolean;onOpen:(s:Service)=>void;renderBanner:(s:Service)=>React.ReactNode;
  onLanguage:()=>void;onProfile:()=>void;
};

export function ServicesScreen({lang,business,onAudience,query,onQuery,services,choosing,onOpen,renderBanner,onLanguage,onProfile}:Props){
  const t=COPY[lang],ar=lang==='ar',row=rowFor(lang);
  const other=business?t.individual:t.company;
  return <GlassScreen>
    <View style={[styles.brandBar,{flexDirection:row}]}>
      <Image source={officialLogo} style={styles.logo} accessible={false}/>
      <View style={g.flex1} accessibilityRole="header">
        <Txt lang={lang} bold style={styles.brand}>{t.brand}</Txt>
        <Txt lang={lang} style={g.meta}>{t.tagline}</Txt>
      </View>
      <ScalePressable accessibilityRole="button" accessibilityLabel={t.languageA11y} onPress={onLanguage} style={styles.round}>
        <Txt lang={ar?'en':'ar'} bold style={styles.languageText}>{ar?'EN':'ع'}</Txt>
      </ScalePressable>
      <ScalePressable accessibilityRole="button" accessibilityLabel={t.profile} onPress={onProfile} style={styles.round}>
        <Icon name="user" size={22} color={colors.ink}/>
      </ScalePressable>
    </View>

    {/* Segmented control */}
    <View accessibilityRole="tablist" accessibilityLabel={t.audience} style={[styles.segment,{flexDirection:row}]}>
      {([[false,t.individual],[true,t.company]] as const).map(([isBusiness,label])=>{const selected=business===isBusiness;
        return <ScalePressable key={label} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected}} aria-selected={selected}
          onPress={()=>onAudience(isBusiness)} style={[styles.segmentItem,selected&&styles.segmentOn]}>
          <Txt lang={lang} bold style={{...styles.segmentText,...(selected?{color:colors.ink}:null)}}>{label}</Txt>
        </ScalePressable>;})}
    </View>

    <View style={[styles.search,{flexDirection:row}]}>
      <Icon name="search" size={20} color={colors.muted}/>
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" value={query} onChangeText={onQuery}
        accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor={onGlass.placeholder} returnKeyType="search" autoCorrect={false}
        style={[styles.searchInput,{textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr',fontFamily:ar?'CairoRegular':undefined}]}/>
      {!!query&&<ScalePressable accessibilityRole="button" accessibilityLabel={t.clear} onPress={()=>onQuery('')} style={styles.clear}>
        <Icon name="close" size={16} color={colors.muted}/>
      </ScalePressable>}
    </View>

    <View style={[g.between,{flexDirection:row}]}>
      <SectionTitle lang={lang}>{choosing?t.choose:business?t.companyTitle:t.individualTitle}</SectionTitle>
      <Txt lang={lang} style={g.meta}>{t.count(services.length)}</Txt>
    </View>

    {services.map(service=><ScalePressable key={service.id} accessibilityRole="button" accessibilityLabel={serviceLabel(service,lang)}
      onPress={()=>onOpen(service)} style={styles.tile}>
      <View style={styles.tileClip}>{renderBanner(service)}</View>
    </ScalePressable>)}

    {services.length===0&&<Note lang={lang}>{`${t.none} ${t.noneHint.replace('{other}',other)}`}</Note>}
  </GlassScreen>;
}

const shadow=Platform.select({
  ios:{shadowColor:colors.brown,shadowOffset:{width:0,height:6},shadowOpacity:0.1,shadowRadius:14},
  android:{elevation:3},default:{},
}) as object;

const styles=StyleSheet.create({
  brandBar:{alignItems:'center',gap:space.md},
  logo:{width:52,height:52,borderRadius:26},
  brand:{fontSize:type.title2,lineHeight:30},
  round:{width:layout.minTouch+2,height:layout.minTouch+2,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border,overflow:'hidden'},
  languageText:{fontSize:type.callout,color:colors.brand},
  segment:{padding:4,gap:4,borderRadius:radius.control+4,backgroundColor:'rgba(91,100,117,0.12)'},
  segmentItem:{flex:1,minHeight:layout.minTouch,borderRadius:radius.control,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  segmentOn:{backgroundColor:colors.white,...shadow},
  segmentText:{fontSize:type.subhead,color:colors.muted},
  search:{alignItems:'center',gap:space.sm,minHeight:layout.minTouch+8,paddingHorizontal:space.md,borderRadius:radius.card,borderWidth:1,borderColor:onGlass.border,
    backgroundColor:'rgba(255,255,255,0.7)'},
  searchInput:{flex:1,minHeight:layout.minTouch,fontSize:type.callout,color:colors.ink},
  clear:{width:layout.minTouch,height:layout.minTouch,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,overflow:'hidden'},
  tile:{borderRadius:radius.card,...shadow},
  tileClip:{borderRadius:radius.card,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.8)'},
});
