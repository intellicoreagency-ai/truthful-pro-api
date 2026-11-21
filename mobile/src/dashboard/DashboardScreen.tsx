/**
 * My Requests — premium concierge design.
 * Frosted header (gold large title, glass search, four spring filter tiles with counts), an "action needed" banner,
 * gradient-bordered glass cards that animate in, re-flow smoothly when filters change, and press with a spring.
 * Logic unchanged: same filters/buckets, search, counts, pull-to-refresh, skeleton, empty / no-match / offline states,
 * drafts and the sample-data toggle. Motion respects Reduce motion; glass is opaque under Reduce transparency.
 */
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Platform,RefreshControl,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import Animated,{FadeIn,FadeInDown,FadeOut,LinearTransition,ReduceMotion,useAnimatedStyle,useReducedMotion,useSharedValue,withRepeat,withTiming} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {StatusBadge,Tag,rowFor,useReduceTransparency} from '../ui/Glass';
import {GoldBadge,GoldText,LuxCard,ScalePressable} from '../ui/Premium';
import {colors,layout,lux,radius,space,type} from '../theme';
import {dateText,steps,type ClientRequest} from '../clientModel';
import {inBucket,type Bucket} from './statusStyle';
import {useTabBarHeight} from '../navigation/TabBarLayout';

type Lang='ar'|'en';
export type SyncStatus='idle'|'syncing'|'error';
type Draft={key:string;title:string;resume:()=>void};
type Props={
  lang:Lang;records:ClientRequest[];drafts:Draft[];syncStatus:SyncStatus;loadedOnce:boolean;demo:boolean;
  onRefresh:()=>Promise<void>|void;onOpen:(r:ClientRequest)=>void;onMissing:(r:ClientRequest)=>void;onStart:()=>void;onLanguage:()=>void;onDemo:()=>void;
};

const copy={
  ar:{title:'طلباتي',subtitle:(n:number)=>n?`${n} معاملة`:'لا معاملات بعد',search:'ابحث بالخدمة أو رقم الطلب',clear:'مسح البحث',filters:'تصفية الطلبات',all:'الكل',active:'الجارية',action:'تحتاج إجراءً',done:'المنجزة',
    details:'تفاصيل الطلب',sendDocs:'إرسال المستندات',updated:'آخر تحديث',drafts:'مسودات',resume:'متابعة',
    needBanner:(n:number)=>n===1?'معاملة واحدة تحتاج إجراءً منك':`${n} معاملات تحتاج إجراءً منك`,needShow:'عرضها',
    loading:'جارٍ تحميل معاملاتك…',emptyTitle:'ستجد معاملاتك هنا',emptyBody:'ابدأ معاملة لمتابعة مراحلها والرجوع لملفاتها في أي وقت.',start:'ابدأ معاملة',
    noMatchTitle:'لا نتائج مطابقة',noMatchBody:'جرّب فلتراً آخر أو غيّر كلمة البحث.',
    offline:'تعذّر التحديث. تُعرض آخر بيانات محفوظة.',retry:'إعادة المحاولة',pull:'اسحب للأسفل للتحديث',demoOn:'عرض معاملاتي',demoOff:'عرض نماذج توضيحية',sample:'توضيحي',stage:(n:number)=>`المرحلة ${n} من ٥`},
  en:{title:'My Requests',subtitle:(n:number)=>n?`${n} transaction${n===1?'':'s'}`:'No transactions yet',search:'Search by service or request number',clear:'Clear search',filters:'Filter requests',all:'All',active:'Active',action:'Needs action',done:'Completed',
    details:'Request details',sendDocs:'Send documents',updated:'Updated',drafts:'Drafts',resume:'Resume',
    needBanner:(n:number)=>n===1?'1 request needs your action':`${n} requests need your action`,needShow:'Show',
    loading:'Loading your transactions…',emptyTitle:'Your transactions will appear here',emptyBody:'Start a transaction to follow its stages and open its files any time.',start:'Start a transaction',
    noMatchTitle:'No matching results',noMatchBody:'Try another filter or change the search.',
    offline:'Could not refresh. Showing the last saved data.',retry:'Try again',pull:'Pull down to refresh',demoOn:'Show my requests',demoOff:'View sample screens',sample:'Sample',stage:(n:number)=>`Stage ${n} of 5`},
} as const;

const ORANGE=lux.orange; // white text on it (≥ 7:1)
const enter=(i:number)=>FadeInDown.delay(60+Math.min(i,6)*60).springify().damping(18).mass(0.8).reduceMotion(ReduceMotion.System);
const flow=LinearTransition.springify().damping(20).reduceMotion(ReduceMotion.System);

/** Soft breathing placeholder while the first load is in flight. */
function Skeleton({reduce}:{reduce:boolean}){
  const reduceMotion=useReducedMotion();
  const o=useSharedValue(0.55);
  useEffect(()=>{if(!reduceMotion)o.value=withRepeat(withTiming(1,{duration:800}),-1,true)},[o,reduceMotion]);
  const a=useAnimatedStyle(()=>({opacity:o.value}));
  return <Animated.View style={a} accessibilityLabel="loading" accessibilityRole="progressbar">
    <LuxCard reduce={reduce} contentStyle={s.skel}>
      <View style={s.skelLine1}/><View style={s.skelLine2}/><View style={s.skelBar}/>
    </LuxCard>
  </Animated.View>;
}

/** Five-segment progress; filled segments in gold. Spoken as "Stage n of 5: name". */
function StageBar({lang,stage}:{lang:Lang;stage:number}){
  return <View style={[s.bar,{flexDirection:rowFor(lang)}]} accessible accessibilityRole="progressbar"
    accessibilityLabel={`${copy[lang].stage(stage)}: ${steps[Math.max(0,stage-1)][lang]}`} accessibilityValue={{min:1,max:5,now:stage}}>
    {[1,2,3,4,5].map(i=>i<=stage
      ?<LinearGradient key={i} colors={lux.goldBright} start={{x:0,y:0}} end={{x:1,y:0}} style={s.seg}/>
      :<View key={i} style={[s.seg,s.segOff]}/>)}
  </View>;
}

function RequestCard({lang,r,onOpen,onMissing,reduce}:{lang:Lang;r:ClientRequest;onOpen:()=>void;onMissing:()=>void;reduce:boolean}){
  const t=copy[lang],ar=lang==='ar',row=rowFor(lang);
  const closed=r.status==='cancelled'||r.status==='rejected';
  const need=r.status==='needs_documents'||!!r.whatNow?.actionRequired;
  return <LuxCard reduce={reduce} style={need&&s.needGlow}>
    <ScalePressable accessibilityRole="button" accessibilityLabel={`${r.title[lang]}. ${t.details}`} onPress={onOpen} scaleTo={0.985} style={s.cardMain}>
      <View style={[s.cardTop,{flexDirection:row}]}>
        <View style={[s.flex1,s.cardTitleBox]}>
          <Txt lang={lang} bold style={s.cardTitle} numberOfLines={2}>{r.title[lang]}</Txt>
          <Txt lang={lang} style={s.meta}>{'⁦#'+r.id.replace('DEMO-','').slice(0,8)+'⁩'} · {t.updated} {dateText(r.updatedAt,lang)}</Txt>
        </View>
        {r.sample&&<Tag lang={lang}>{t.sample}</Tag>}
      </View>
      <StatusBadge lang={lang} status={r.status}/>
      {!closed&&r.status!=='draft'&&<StageBar lang={lang} stage={r.stage}/>}
      {r.whatNow?.[lang]&&r.status!=='draft'?<View style={[s.what,need&&s.whatNeed,{flexDirection:row}]}>
        {need&&<Icon name="info" size={18} color="#6E5426"/>}
        <View style={s.flex1}><Txt lang={lang} bold={need} style={{...s.whatText,...(need?{color:'#6E5426'}:null)}}>{r.whatNow[lang]}</Txt></View>
      </View>:null}
    </ScalePressable>
    <View style={[s.footer,{flexDirection:row}]}>
      {r.status==='needs_documents'
        ?<ScalePressable accessibilityRole="button" accessibilityLabel={`${t.sendDocs}: ${r.title[lang]}`} onPress={onMissing} rippleColor="rgba(11,31,58,0.18)" style={s.actionPill}>
          <LinearGradient colors={ORANGE} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
          <View pointerEvents="none" style={[s.actionInner,{flexDirection:row}]}><Icon name="upload" size={16} color={lux.onAction}/><Txt lang={lang} bold style={s.actionText}>{t.sendDocs}</Txt></View>
        </ScalePressable>
        :<View/>}
      <ScalePressable accessibilityRole="button" accessibilityLabel={`${t.details}: ${r.title[lang]}`} onPress={onOpen} style={[s.detailsLink,{flexDirection:row}]}>
        <Txt lang={lang} bold style={s.detailsText}>{t.details}</Txt>
        <GoldBadge icon={ar?'back':'next'} size={28}/>
      </ScalePressable>
    </View>
  </LuxCard>;
}

export function DashboardScreen({lang,records,drafts,syncStatus,loadedOnce,demo,onRefresh,onOpen,onMissing,onStart,onDemo}:Props){
  const t=copy[lang],ar=lang==='ar',row=rowFor(lang);
  const reduce=useReduceTransparency();
  const [bucket,setBucket]=useState<Bucket>('all');
  const [query,setQuery]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [headerH,setHeaderH]=useState(190);
  const barH=useTabBarHeight();
  const list=useMemo(()=>records.filter(r=>r.status!=='draft'),[records]);
  const q=query.trim().toLowerCase();
  const visible=useMemo(()=>list.filter(r=>inBucket(r,bucket)&&(!q||JSON.stringify([r.title.ar,r.title.en,r.id,r.name]).toLowerCase().includes(q))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[list,bucket,q]);
  const counts=useMemo(()=>({all:list.length,active:list.filter(r=>inBucket(r,'active')).length,action:list.filter(r=>inBucket(r,'action')).length,done:list.filter(r=>inBucket(r,'done')).length}),[list]);

  const doRefresh=useCallback(async()=>{
    setRefreshing(true);const t0=Date.now();
    try{await onRefresh();}finally{const wait=Math.max(0,650-(Date.now()-t0));setTimeout(()=>setRefreshing(false),wait);} // never flicker
  },[onRefresh]);

  const loading=syncStatus==='syncing'&&!loadedOnce&&list.length===0;
  const empty=!loading&&list.length===0;
  const filters:Bucket[]=['all','active','action','done'];
  return <View style={s.fill}>
    <View pointerEvents="none" style={s.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.orb,s.orbGold]}/><View style={[s.orb,s.orbSand]}/>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.scroll,{paddingTop:headerH+space.md,paddingBottom:barH+space.xxl}]} scrollIndicatorInsets={{top:headerH,bottom:barH}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void doRefresh()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor="#FFFFFF" progressViewOffset={headerH}/>}>

      {syncStatus==='error'&&!loading?<Animated.View entering={FadeIn} style={[s.notice,{flexDirection:row}]} accessibilityLiveRegion="polite">
        <Icon name="info" size={18} color="#6E5426"/><View style={s.flex1}><Txt lang={lang} style={s.noticeText}>{t.offline}</Txt></View>
        <ScalePressable accessibilityRole="button" onPress={()=>void doRefresh()} style={s.retry}><Txt lang={lang} bold style={s.retryText}>{t.retry}</Txt></ScalePressable>
      </Animated.View>:null}

      {counts.action>0&&bucket!=='action'&&!q?<Animated.View entering={enter(0)} layout={flow}>
        <ScalePressable accessibilityRole="button" accessibilityLabel={`${t.needBanner(counts.action)}. ${t.needShow}`} onPress={()=>setBucket('action')} style={s.needBannerPress}>
          <LinearGradient colors={['#F3EAD6','#E2CC97']} start={{x:0,y:0}} end={{x:1,y:1}} style={[s.needBanner,{flexDirection:row}]}>
            <GoldBadge icon="bell" size={38}/>
            <View style={s.flex1}><Txt lang={lang} bold style={s.needText}>{t.needBanner(counts.action)}</Txt></View>
            <Txt lang={lang} bold style={s.needShow}>{t.needShow}</Txt>
          </LinearGradient>
        </ScalePressable>
      </Animated.View>:null}

      {loading?<><Skeleton reduce={reduce}/><Skeleton reduce={reduce}/><Skeleton reduce={reduce}/></>:null}

      {empty?<Animated.View entering={enter(0)} style={s.empty}>
        <GoldBadge icon="folder" size={84}/>
        <GoldText lang={lang} style={s.emptyTitle}>{t.emptyTitle}</GoldText>
        <Txt lang={lang} style={s.emptyBody}>{t.emptyBody}</Txt>
        <ScalePressable accessibilityRole="button" accessibilityLabel={t.start} onPress={onStart} rippleColor="rgba(11,31,58,0.18)" style={s.startBtn}>
          <LinearGradient colors={ORANGE} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
          <View pointerEvents="none" style={[s.actionInner,{flexDirection:row}]}><Icon name="plus" size={20} color={lux.onAction}/><Txt lang={lang} bold style={s.startText}>{t.start}</Txt></View>
        </ScalePressable>
        <Txt lang={lang} style={s.pullHint}>{t.pull}</Txt>
      </Animated.View>:null}

      {!loading&&!empty&&visible.length===0?<Animated.View entering={FadeIn} style={s.empty}>
        <GoldBadge icon="search" size={72}/>
        <Txt lang={lang} bold style={s.noMatchTitle}>{t.noMatchTitle}</Txt><Txt lang={lang} style={s.emptyBody}>{t.noMatchBody}</Txt>
      </Animated.View>:null}

      {drafts.length&&bucket==='all'&&!q?<Animated.View entering={enter(1)} layout={flow} style={s.section}>
        <Txt lang={lang} bold style={s.sectionTitle}>{t.drafts}</Txt>
        {drafts.map(d=><ScalePressable key={d.key} accessibilityRole="button" accessibilityLabel={`${t.resume}: ${d.title}`} onPress={d.resume} style={s.draftPress}>
          <LuxCard reduce={reduce} radius={18} contentStyle={[s.draft,{flexDirection:row}]}>
            <GoldBadge icon="edit" size={34}/>
            <View style={s.flex1}><Txt lang={lang} bold style={s.draftText} numberOfLines={1}>{d.title}</Txt></View>
            <Txt lang={lang} style={s.draftResume}>{t.resume}</Txt>
          </LuxCard>
        </ScalePressable>)}
      </Animated.View>:null}

      {visible.map((r,i)=><Animated.View key={r.id} entering={enter(i+2)} exiting={FadeOut.duration(160).reduceMotion(ReduceMotion.System)} layout={flow}>
        <RequestCard lang={lang} r={r} reduce={reduce} onOpen={()=>onOpen(r)} onMissing={()=>onMissing(r)}/>
      </Animated.View>)}

      {!loading?<ScalePressable accessibilityRole="button" onPress={onDemo} style={s.demoLink}><Txt lang={lang} style={s.demoText}>{demo?t.demoOn:t.demoOff}</Txt></ScalePressable>:null}
    </ScrollView>

    {/* Frosted header: content scrolls beneath it */}
    <View style={s.header} onLayout={e=>setHeaderH(e.nativeEvent.layout.height)}>
      {!reduce&&<BlurView style={StyleSheet.absoluteFill} tint="light" intensity={70} experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined}/>}
      <LinearGradient pointerEvents="none" colors={reduce?[lux.ivory,lux.ivory]:['rgba(244,245,247,0.92)','rgba(244,245,247,0.72)']} style={StyleSheet.absoluteFill}/>
      <LinearGradient pointerEvents="none" colors={['rgba(201,164,92,0)','rgba(201,164,92,0.7)','rgba(201,164,92,0)']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.headerLine}/>
      <View style={s.headerInner}>
        <GoldText lang={lang} style={s.largeTitle}>{t.title}</GoldText>
        <Txt lang={lang} style={s.subtitle}>{loading?t.loading:t.subtitle(list.length)}{syncStatus==='syncing'&&loadedOnce?' · …':''}</Txt>
        <LuxCard reduce={reduce} radius={16} contentStyle={[s.search,{flexDirection:row}]}>
          <Icon name="search" size={18} color={colors.brand}/>
          <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor="rgba(11,31,58,0.5)"
            value={query} onChangeText={setQuery} returnKeyType="search" style={[s.searchInput,ar?{fontFamily:'CairoRegular',textAlign:'right',writingDirection:'rtl'}:{textAlign:'left'}]}/>
          {!!query&&<ScalePressable accessibilityRole="button" accessibilityLabel={t.clear} onPress={()=>setQuery('')} style={s.clear}><View pointerEvents="none"><Icon name="close" size={16} color={colors.muted}/></View></ScalePressable>}
        </LuxCard>
        {/* Four equal filter tiles: everything visible at once, in both directions (no sideways scrolling). */}
        <View accessibilityRole="tablist" accessibilityLabel={t.filters} style={[s.filters,{flexDirection:row}]}>
          {filters.map(f=>{const on=bucket===f;const alert=f==='action'&&counts.action>0;
            return <View key={f} style={s.flex1}><ScalePressable accessibilityRole="tab" accessibilityState={{selected:on}} aria-selected={on} accessibilityLabel={`${t[f]} ${counts[f]}`}
              onPress={()=>setBucket(f)} rippleColor={on?'rgba(255,255,255,0.25)':undefined} style={[s.filter,on&&s.filterOn,alert&&!on&&s.filterAlert]}>
              {on&&<LinearGradient colors={[lux.espressoSoft,lux.espresso]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>}
              <View pointerEvents="none" style={s.filterInner}>
                <Txt lang="en" bold style={{...s.filterCount,...(on?{color:'#E2CC97'}:alert?{color:'#80622C'}:null)}}>{String(counts[f])}</Txt>
                <Txt lang={lang} bold={on} numberOfLines={2} style={{...s.filterText,...(on?{color:lux.onDark}:null)}}>{t[f]}</Txt>
              </View>
            </ScalePressable></View>;})}
        </View>
      </View>
    </View>
  </View>;
}

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:lux.ivory},
  flex1:{flex:1},
  backdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden'},
  orb:{position:'absolute',width:340,height:340,borderRadius:170},
  orbGold:{backgroundColor:'#C9D3E6',opacity:0.22,top:120,right:-160},
  orbSand:{backgroundColor:lux.sand,opacity:0.9,top:520,left:-170},
  scroll:{paddingHorizontal:space.lg,gap:space.lg,width:'100%',maxWidth:600,alignSelf:'center'},

  header:{position:'absolute',top:0,left:0,right:0,overflow:'hidden'},
  headerLine:{position:'absolute',bottom:0,left:0,right:0,height:1},
  headerInner:{paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.md,gap:space.sm,width:'100%',maxWidth:600,alignSelf:'center'},
  largeTitle:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.25},
  subtitle:{fontSize:type.subhead,color:colors.muted,marginTop:-space.xs},
  search:{minHeight:48,alignItems:'center',gap:space.sm,paddingHorizontal:space.md},
  searchInput:{flex:1,minWidth:0,minHeight:layout.minTouch,fontSize:type.callout,color:colors.ink},
  clear:{width:layout.minTouch,height:layout.minTouch,alignItems:'center',justifyContent:'center',borderRadius:radius.pill,overflow:'hidden'},
  filters:{gap:space.sm},
  filter:{minHeight:58,borderRadius:16,borderWidth:1,borderColor:'rgba(201,164,92,0.55)',backgroundColor:'rgba(255,255,255,0.85)',overflow:'hidden',justifyContent:'center'},
  filterOn:{borderColor:'rgba(201,164,92,0.9)'},
  filterAlert:{borderColor:'rgba(11,31,58,0.55)',backgroundColor:'rgba(243,234,214,0.9)'},
  filterInner:{alignItems:'center',paddingHorizontal:4,paddingVertical:6},
  filterCount:{fontSize:type.headline,lineHeight:22,color:colors.ink,textAlign:'center'},
  filterText:{fontSize:type.caption,lineHeight:15,color:colors.muted,textAlign:'center'},

  needBannerPress:{borderRadius:20},
  needBanner:{alignItems:'center',gap:space.md,padding:space.md,borderRadius:20,borderWidth:1,borderColor:'rgba(168,132,63,0.6)'},
  needText:{fontSize:type.subhead,lineHeight:22,color:'#5E4720'},
  needShow:{fontSize:type.subhead,color:colors.brand},

  needGlow:Platform.select({ios:{shadowColor:'#0B1F3A',shadowOpacity:0.22},default:{}}) as object,
  cardMain:{padding:space.lg+2,gap:space.md},
  cardTop:{alignItems:'flex-start',gap:space.md},
  cardTitleBox:{gap:2},
  cardTitle:{fontSize:type.headline,lineHeight:26},
  meta:{fontSize:type.footnote,lineHeight:18,color:colors.muted},
  bar:{gap:5},
  seg:{flex:1,height:6,borderRadius:3},
  segOff:{backgroundColor:'rgba(91,100,117,0.14)'},
  what:{gap:space.sm,alignItems:'flex-start'},
  whatNeed:{backgroundColor:'rgba(243,234,214,0.9)',borderRadius:14,padding:space.md,borderWidth:1,borderColor:'rgba(168,132,63,0.45)'},
  whatText:{fontSize:type.subhead,lineHeight:22,color:colors.muted},
  footer:{alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderColor:'rgba(201,164,92,0.28)',paddingHorizontal:space.lg,minHeight:layout.minTouch+12},
  actionPill:{minHeight:40,borderRadius:radius.pill,overflow:'hidden',justifyContent:'center'},
  actionInner:{alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:space.md+2},
  actionText:{fontSize:type.footnote+1,color:lux.onAction},
  detailsLink:{alignItems:'center',gap:space.sm,minHeight:layout.minTouch,paddingHorizontal:space.xs},
  detailsText:{fontSize:type.subhead,color:colors.brand},

  notice:{alignItems:'center',gap:space.sm,padding:space.md,borderRadius:16,backgroundColor:'#F6EFE0',borderWidth:1,borderColor:'rgba(168,132,63,0.45)'},
  noticeText:{fontSize:type.footnote,lineHeight:18,color:'#6E5426'},
  retry:{paddingHorizontal:space.sm,minHeight:layout.minTouch,justifyContent:'center'},retryText:{fontSize:type.footnote,color:colors.brand},

  empty:{alignItems:'center',gap:space.md,paddingVertical:space.xxl,paddingHorizontal:space.lg},
  emptyTitle:{fontSize:type.title2+2,lineHeight:34,textAlign:'center'},
  noMatchTitle:{fontSize:type.title2,lineHeight:30,textAlign:'center'},
  emptyBody:{fontSize:type.callout,lineHeight:26,color:colors.muted,textAlign:'center'},
  startBtn:{minHeight:54,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:colors.gold,justifyContent:'center',paddingHorizontal:space.xl,marginTop:space.sm},
  startText:{fontSize:type.headline,color:lux.onAction},
  pullHint:{fontSize:type.caption,color:colors.muted,marginTop:space.sm,textAlign:'center'},

  section:{gap:space.sm},sectionTitle:{fontSize:type.subhead,color:colors.muted},
  draftPress:{borderRadius:18},
  draft:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+12,paddingHorizontal:space.md},
  draftText:{fontSize:type.callout,lineHeight:24},
  draftResume:{fontSize:type.footnote+1,color:colors.brand},
  demoLink:{alignSelf:'center',minHeight:layout.minTouch,justifyContent:'center',paddingHorizontal:space.md},demoText:{fontSize:type.footnote+1,color:colors.muted,textDecorationLine:'underline'},

  skel:{padding:space.lg+2,gap:space.md},
  skelLine1:{height:20,width:'70%',borderRadius:8,backgroundColor:'#DDE2EA'},
  skelLine2:{height:14,width:'45%',borderRadius:7,backgroundColor:'#E6EAF1'},
  skelBar:{height:6,borderRadius:3,backgroundColor:'#E6EAF1'},
});
