/**
 * Services catalogue — glass redesign (replaces `cataloguePage` in App.tsx).
 * Audience switch (individuals / companies), search, and the unified main services as navy & gold banners.
 * A main service with one branch opens that service directly; one with several shows its branches first.
 */
import React,{useEffect,useMemo,useState} from 'react';
import {BackHandler,Image,Platform,StyleSheet,TextInput,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {officialLogo} from '../ReferenceUI';
import {Txt,type Lang} from '../ui/Txt';
import {GlassScreen,Note,SectionTitle,g,rowFor} from '../ui/Glass';
import {colors,layout,lux,onGlass,radius,space,type} from '../theme';
import {type Service} from '../services';
import {structureFor} from '../serviceDetails';
import {branchesFor,categoriesFor,serviceForBranch,type Branch,type Category} from '../catalogue/categories';
import {CategoryBanner,countLabel} from '../catalogue/CategoryBanner';
import {Entrance} from '../ui/Premium';
import {LanguageButton} from '../ui/LanguageButton';
import {pick,tr} from '../i18n';

const COPY={
  ar:{brand:'تروثفل برو',tagline:'خدمات تخليص المعاملات',languageA11y:'التبديل إلى الإنجليزية',profile:'حسابي',
    individual:'الأفراد',company:'الشركات',audience:'نوع الخدمات',search:'ابحث عن خدمة أو معاملة...',clear:'مسح البحث',
    individualTitle:'خدمات الأفراد',companyTitle:'خدمات الشركات',choose:'اختر الخدمة',
    count:(n:number)=>n===1?'خدمة واحدة':n===2?'خدمتان':n<=10?`${n} خدمات`:`${n} خدمة`,allServices:'كل الخدمات',chooseBranch:'اختر الخدمة الفرعية',none:'لم نجد خدمة مطابقة.',noneHint:'جرّب كلمة أخرى أو انتقل إلى خدمات {other}.'},
  en:{brand:'TRUTHFUL PRO',tagline:'Document clearance services',languageA11y:'Switch to Arabic',profile:'My Account',
    individual:'Individuals',company:'Companies',audience:'Service type',search:'Search for a service...',clear:'Clear search',
    individualTitle:'Individual Services',companyTitle:'Company Services',choose:'Choose service',
    count:(n:number)=>`${n} service${n===1?'':'s'}`,allServices:'All services',chooseBranch:'Choose a branch',none:'No matching services.',noneHint:'Try another word or switch to {other}.'},
  ru:{tagline:'Услуги по оформлению документов',languageA11y:'Сменить язык',profile:'Мой профиль',
    individual:'Частным лицам',company:'Компаниям',audience:'Тип услуг',search:'Поиск услуги...',clear:'Очистить поиск',
    individualTitle:'Услуги для частных лиц',companyTitle:'Услуги для компаний',choose:'Выберите услугу',
    count:(n:number)=>{const m=n%10,h=n%100;return `${n} ${m===1&&h!==11?'услуга':m>=2&&m<=4&&(h<12||h>14)?'услуги':'услуг'}`},allServices:'Все услуги',chooseBranch:'Выберите направление',none:'Подходящих услуг не найдено.',noneHint:'Попробуйте другое слово или перейдите в раздел «{other}».'},
  zh:{tagline:'文件清关服务',languageA11y:'切换语言',profile:'我的账户',
    individual:'个人',company:'企业',audience:'服务类型',search:'搜索服务...',clear:'清除搜索',
    individualTitle:'个人服务',companyTitle:'企业服务',choose:'选择服务',
    count:(n:number)=>`${n} 项服务`,allServices:'全部服务',chooseBranch:'选择子服务',none:'未找到匹配的服务。',noneHint:'请换个关键词，或切换到“{other}”。'},
  fr:{tagline:'Services de formalités administratives',languageA11y:'Changer de langue',profile:'Mon compte',
    individual:'Particuliers',company:'Entreprises',audience:'Type de services',search:'Rechercher un service...',clear:'Effacer la recherche',
    individualTitle:'Services aux particuliers',companyTitle:'Services aux entreprises',choose:'Choisir un service',
    count:(n:number)=>`${n} service${n>1?'s':''}`,allServices:'Tous les services',chooseBranch:'Choisissez une rubrique',none:'Aucun service correspondant.',noneHint:'Essayez un autre mot ou passez à « {other} ».'},
  es:{tagline:'Servicios de trámites y documentación',languageA11y:'Cambiar idioma',profile:'Mi cuenta',
    individual:'Particulares',company:'Empresas',audience:'Tipo de servicios',search:'Buscar un servicio...',clear:'Borrar búsqueda',
    individualTitle:'Servicios para particulares',companyTitle:'Servicios para empresas',choose:'Elegir servicio',
    count:(n:number)=>`${n} servicio${n===1?'':'s'}`,allServices:'Todos los servicios',chooseBranch:'Elija una opción',none:'No hay servicios que coincidan.',noneHint:'Pruebe otra palabra o cambie a «{other}».'},
} as const;

type Props={
  lang:Lang;business:boolean;onAudience:(business:boolean)=>void;query:string;onQuery:(q:string)=>void;
  services:Service[];choosing:boolean;onOpen:(s:Service)=>void;
  onLanguage:()=>void;onProfile:()=>void;
};

const actionsIn=(br:Branch)=>structureFor(br.serviceId)?.actions.length??0;

export function ServicesScreen({lang,business,onAudience,query,onQuery,services,choosing,onOpen,onLanguage,onProfile}:Props){
  const t=pick(COPY,lang),ar=lang==='ar',row=rowFor(lang);
  const other=business?t.individual:t.company;
  // Main services whose branches survive the audience + search filter the app already applied to `services`.
  const visible=useMemo(()=>{const ids=new Set(services.map(x=>x.id));
    return categoriesFor(business).map(c=>({c,branches:branchesFor(c,business).filter(br=>ids.has(br.serviceId))})).filter(x=>x.branches.length>0);
  },[services,business]);
  const [openId,setOpenId]=useState<Category['id']|null>(null);
  useEffect(()=>{setOpenId(null)},[business,query]);
  const open=visible.find(x=>x.c.id===openId);
  useEffect(()=>{ // Android back closes the branch list before leaving the screen
    if(!open)return;
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{setOpenId(null);return true});
    return ()=>sub.remove();
  },[open]);
  const choose=(c:Category,branches:Branch[])=>{
    if(branches.length===1){const svc=serviceForBranch(branches[0]!);if(svc)onOpen(svc);return;}
    setOpenId(c.id);
  };

  if(open)return <GlassScreen>
    <ScalePressable accessibilityRole="button" accessibilityLabel={t.allServices} onPress={()=>setOpenId(null)} style={[styles.backRow,{flexDirection:row,alignSelf:ar?'flex-end':'flex-start'}]}>
      <Icon name={ar?'next':'back'} size={18} color={colors.brand}/><Txt lang={lang} bold style={styles.backText}>{t.allServices}</Txt>
    </ScalePressable>
    <CategoryBanner lang={lang} id={open.c.id} photoId={open.branches[0]!.serviceId} title={tr(open.c.title,lang)} subtitle={tr(open.c.desc,lang)} count={open.branches.reduce((n,br)=>n+actionsIn(br),0)} tall/>
    <SectionTitle lang={lang}>{t.chooseBranch}</SectionTitle>
    {open.branches.map((br,i)=>{const svc=serviceForBranch(br);if(!svc)return null;
      return <Entrance key={br.serviceId} index={i}>
        <ScalePressable accessibilityRole="button" accessibilityLabel={`${tr(br.title,lang)}. ${tr(br.desc,lang)}`} onPress={()=>onOpen(svc)} style={[styles.branch,{flexDirection:row}]}>
          <View style={styles.branchDot}><Txt lang="en" bold style={styles.branchNum}>{String(i+1)}</Txt></View>
          <View style={g.flex1}>
            <Txt lang={lang} bold style={{...styles.branchTitle,textAlign:ar?'right':'left'}}>{tr(br.title,lang)}</Txt>
            <Txt lang={lang} style={{...g.meta,textAlign:ar?'right':'left'}}>{tr(br.desc,lang)}</Txt>
            <Txt lang={lang} bold style={{...styles.branchCount,textAlign:ar?'right':'left'}}>{countLabel(actionsIn(br),lang)}</Txt>
          </View>
          <Icon name={ar?'back':'next'} size={20} color={colors.gold}/>
        </ScalePressable>
      </Entrance>;})}
  </GlassScreen>;

  return <GlassScreen>
    <View style={[styles.brandBar,{flexDirection:row}]}>
      <Image source={officialLogo} style={styles.logo} accessible={false}/>
      <View style={g.flex1} accessibilityRole="header">
        <Txt lang={lang} bold style={styles.brand}>{t.brand}</Txt>
        <Txt lang={lang} style={g.meta}>{t.tagline}</Txt>
      </View>
      <LanguageButton lang={lang} onPress={onLanguage}/>
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
      <Txt lang={lang} style={g.meta}>{t.count(visible.length)}</Txt>
    </View>

    {visible.map(({c,branches},i)=><Entrance key={c.id} index={i}>
      <ScalePressable accessibilityRole="button" accessibilityLabel={`${tr(c.title,lang)}. ${tr(c.desc,lang)}`} onPress={()=>choose(c,branches)} style={styles.tile}>
        <CategoryBanner lang={lang} id={c.id} photoId={branches[0]!.serviceId} title={tr(c.title,lang)}
          subtitle={branches.length>1?branches.map(br=>tr(br.title,lang)).join(ar?' · ':' · '):tr(c.desc,lang)}
          count={branches.reduce((n,br)=>n+actionsIn(br),0)}/>
      </ScalePressable>
    </Entrance>)}

    {visible.length===0&&<Note lang={lang}>{`${t.none} ${t.noneHint.replace('{other}',other)}`}</Note>}
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
  backRow:{alignItems:'center',gap:space.xs,minHeight:layout.minTouch,paddingHorizontal:space.sm,borderRadius:radius.pill,overflow:'hidden'},
  backText:{fontSize:type.subhead,color:colors.brand},
  branch:{alignItems:'center',gap:space.md,padding:space.lg,borderRadius:radius.card,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,overflow:'hidden',...shadow},
  branchDot:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:lux.espresso,borderWidth:1,borderColor:colors.gold},
  branchNum:{fontSize:type.subhead,color:lux.goldBright[0]},
  branchTitle:{fontSize:type.headline,lineHeight:24,color:colors.ink},
  branchCount:{fontSize:type.caption,lineHeight:18,color:lux.goldText[0],marginTop:2},
});
