import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Platform,RefreshControl,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {BlurView} from 'expo-blur';
import {Pressable} from '../Touch';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {dateText,statusLabels,steps,type ClientRequest} from '../clientModel';
import {inBucket,statusTone,type Bucket} from './statusStyle';
import {useTabBarHeight} from '../navigation/TabBarLayout';

type Lang='ar'|'en';
export type SyncStatus='idle'|'syncing'|'error';
type Draft={key:string;title:string;resume:()=>void};
type Props={
  lang:Lang;records:ClientRequest[];drafts:Draft[];syncStatus:SyncStatus;loadedOnce:boolean;demo:boolean;
  onRefresh:()=>Promise<void>|void;onOpen:(r:ClientRequest)=>void;onMissing:(r:ClientRequest)=>void;onStart:()=>void;onLanguage:()=>void;onDemo:()=>void;
};

const copy={
  ar:{title:'طلباتي',subtitle:(n:number)=>n?`${n} معاملة`:'لا معاملات بعد',search:'ابحث بالخدمة أو رقم الطلب',all:'الكل',active:'الجارية',action:'تحتاج إجراءً',done:'المنجزة',
    details:'تفاصيل الطلب',sendDocs:'إرسال المستندات',updated:'آخر تحديث',drafts:'مسودات',
    loading:'جارٍ تحميل معاملاتك…',emptyTitle:'ستجد معاملاتك هنا',emptyBody:'ابدأ معاملة لمتابعة مراحلها والرجوع لملفاتها في أي وقت.',start:'ابدأ معاملة',
    noMatchTitle:'لا نتائج مطابقة',noMatchBody:'جرّب فلتراً آخر أو غيّر كلمة البحث.',
    offline:'تعذّر التحديث. تُعرض آخر بيانات محفوظة.',retry:'إعادة المحاولة',pull:'اسحب للأسفل للتحديث',demoOn:'عرض معاملاتي',demoOff:'عرض نماذج توضيحية',sample:'توضيحي'},
  en:{title:'My Requests',subtitle:(n:number)=>n?`${n} transaction${n===1?'':'s'}`:'No transactions yet',search:'Search by service or request number',all:'All',active:'Active',action:'Needs action',done:'Completed',
    details:'Request details',sendDocs:'Send documents',updated:'Updated',drafts:'Drafts',
    loading:'Loading your transactions…',emptyTitle:'Your transactions will appear here',emptyBody:'Start a transaction to follow its stages and open its files any time.',start:'Start a transaction',
    noMatchTitle:'No matching results',noMatchBody:'Try another filter or change the search.',
    offline:'Could not refresh. Showing the last saved data.',retry:'Try again',pull:'Pull down to refresh',demoOn:'Show my requests',demoOff:'View sample screens',sample:'Sample'},
} as const;

const shadow=Platform.select({
  ios:{shadowColor:'#3C281B',shadowOffset:{width:0,height:6},shadowOpacity:0.1,shadowRadius:14},
  android:{elevation:3},
  default:{boxShadow:'0 6px 16px rgba(60,40,27,0.10)'},
}) as object;

/** Pulsing placeholder while the first load is in flight. */
function Skeleton(){
  const v=useRef(new Animated.Value(0.45)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:1,duration:700,useNativeDriver:true}),Animated.timing(v,{toValue:0.45,duration:700,useNativeDriver:true})]));a.start();return()=>a.stop();},[v]);
  return <Animated.View style={[s.card,{opacity:v,gap:space.md}]} accessibilityLabel="loading" accessibilityRole="progressbar">
    <View style={s.skelLine1}/><View style={s.skelLine2}/><View style={s.skelDots}/>
  </Animated.View>;
}

function StageDots({lang,stage,tone}:{lang:Lang;stage:number;tone:string}){
  return <View style={[s.dots,{flexDirection:lang==='ar'?'row-reverse':'row'}]} accessibilityLabel={`${steps[Math.max(0,stage-1)][lang]} ${stage}/5`}>
    {[1,2,3,4,5].map(i=><View key={i} style={[s.dot,i<=stage&&{backgroundColor:tone}]}/>)}
  </View>;
}

function RequestCard({lang,r,onOpen,onMissing}:{lang:Lang;r:ClientRequest;onOpen:()=>void;onMissing:()=>void}){
  const t=copy[lang],ar=lang==='ar',tone=statusTone(r.status);
  const closed=r.status==='cancelled'||r.status==='rejected';
  const need=r.status==='needs_documents'?true:!!r.whatNow?.actionRequired;
  return <View style={s.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${r.title[lang]}. ${statusLabels[r.status][lang]}`} onPress={onOpen} style={s.cardMain}>
      <View style={[s.row,{flexDirection:ar?'row-reverse':'row'}]}>
        <Txt lang={lang} style={s.cardTitle} numberOfLines={2}>{r.title[lang]}</Txt>
        <View style={[s.badge,{backgroundColor:tone.bg}]}><Txt lang={lang} style={[s.badgeText,{color:tone.fg}]}>{statusLabels[r.status][lang]}</Txt></View>
      </View>
      <Txt lang={lang} style={s.meta}>{'⁦#'+r.id.replace('DEMO-','').slice(0,8)+'⁩'} · {t.updated} {dateText(r.updatedAt,lang)}</Txt>
      {!closed&&r.status!=='draft'?<StageDots lang={lang} stage={r.stage} tone={tone.fg}/>:null}
      {r.whatNow?.[lang]&&r.status!=='draft'?<Txt lang={lang} style={[s.what,need&&s.whatNeed]}>{r.whatNow[lang]}</Txt>:null}
    </Pressable>
    <View style={[s.footer,{flexDirection:ar?'row-reverse':'row'}]}>
      {r.status==='needs_documents'?<Pressable accessibilityRole="button" accessibilityLabel={t.sendDocs} onPress={onMissing} style={s.actionPill}><Txt lang={lang} style={s.actionText}>{t.sendDocs}</Txt></Pressable>:<View/>}
      <Pressable accessibilityRole="button" accessibilityLabel={t.details} onPress={onOpen} style={[s.detailsLink,{flexDirection:ar?'row-reverse':'row'}]}>
        <Txt lang={lang} style={s.detailsText}>{t.details}</Txt><Icon name={ar?'back':'next'} size={16} color={colors.brand}/>
      </Pressable>
    </View>
  </View>;
}

/**
 * Dashboard: large title and filters in a translucent (blurred) header, Apple-style cards with soft shadows and generous spacing,
 * pull-to-refresh, skeleton loading, elegant empty / no-match / offline states. Data comes from the API sync (server is the reference).
 */
export function DashboardScreen({lang,records,drafts,syncStatus,loadedOnce,demo,onRefresh,onOpen,onMissing,onStart,onDemo}:Props){
  const t=copy[lang],ar=lang==='ar';
  const [bucket,setBucket]=useState<Bucket>('all');
  const [query,setQuery]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [headerH,setHeaderH]=useState(150);
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
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.scroll,{paddingTop:headerH+space.md,paddingBottom:barH+space.xxl}]} scrollIndicatorInsets={{top:headerH,bottom:barH}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void doRefresh()} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor="#FFFFFF" progressViewOffset={headerH}/>}>
      {syncStatus==='error'&&!loading?<View style={[s.notice,{flexDirection:ar?'row-reverse':'row'}]} accessibilityLiveRegion="polite">
        <Icon name="info" size={18} color="#8A4F0B"/><Txt lang={lang} style={s.noticeText}>{t.offline}</Txt>
        <Pressable accessibilityRole="button" onPress={()=>void doRefresh()} style={s.retry}><Txt lang={lang} style={s.retryText}>{t.retry}</Txt></Pressable>
      </View>:null}
      {loading?<><Skeleton/><Skeleton/><Skeleton/></>:null}
      {empty?<View style={s.empty}>
        <View style={s.emptyIcon}><Icon name="folder" size={34} color={colors.brand}/></View>
        <Txt lang={lang} style={s.emptyTitle}>{t.emptyTitle}</Txt>
        <Txt lang={lang} style={s.emptyBody}>{t.emptyBody}</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={t.start} onPress={onStart} style={s.startBtn} rippleColor="rgba(48,37,31,0.18)"><Txt lang={lang} style={s.startText}>{t.start}</Txt></Pressable>
        <Txt lang={lang} style={s.pullHint}>{t.pull}</Txt>
      </View>:null}
      {!loading&&!empty&&visible.length===0?<View style={s.empty}>
        <View style={s.emptyIcon}><Icon name="search" size={30} color={colors.brand}/></View>
        <Txt lang={lang} style={s.emptyTitle}>{t.noMatchTitle}</Txt><Txt lang={lang} style={s.emptyBody}>{t.noMatchBody}</Txt>
      </View>:null}
      {drafts.length&&bucket==='all'&&!q?<View style={s.section}>
        <Txt lang={lang} style={s.sectionTitle}>{t.drafts}</Txt>
        {drafts.map(d=><Pressable key={d.key} accessibilityRole="button" onPress={d.resume} style={[s.draft,{flexDirection:ar?'row-reverse':'row'}]}><Icon name="edit" size={20} color={colors.brand}/><Txt lang={lang} style={s.draftText} numberOfLines={1}>{d.title}</Txt></Pressable>)}
      </View>:null}
      {visible.map(r=><RequestCard key={r.id} lang={lang} r={r} onOpen={()=>onOpen(r)} onMissing={()=>onMissing(r)}/>)}
      {!loading?<Pressable accessibilityRole="button" onPress={onDemo} style={s.demoLink}><Txt lang={lang} style={s.demoText}>{demo?t.demoOn:t.demoOff}</Txt></Pressable>:null}
    </ScrollView>

    {/* translucent header: content scrolls beneath it */}
    <View style={s.header} onLayout={e=>setHeaderH(e.nativeEvent.layout.height)}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={60} blurMethod="none"/>
      <View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(248,243,237,0.72)'}]} pointerEvents="none"/>
      <View style={s.headerLine} pointerEvents="none"/>
      <View style={s.headerInner}>
        <Txt lang={lang} style={s.largeTitle}>{t.title}</Txt>
        <Txt lang={lang} style={s.subtitle}>{loading?t.loading:t.subtitle(list.length)}{syncStatus==='syncing'&&loadedOnce?' · …':''}</Txt>
        <View style={[s.search,{flexDirection:ar?'row-reverse':'row'}]}>
          <Icon name="search" size={18} color={onGlass.soft}/>
          <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor={onGlass.placeholder}
            value={query} onChangeText={setQuery} returnKeyType="search" style={[s.searchInput,ar?{fontFamily:'CairoRegular',textAlign:'right',writingDirection:'rtl'}:{textAlign:'left'}]}/>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chips,{flexDirection:ar?'row-reverse':'row'}]} style={s.chipsScroll}>
          {filters.map(f=>{const on=bucket===f;return <Pressable key={f} accessibilityRole="button" accessibilityState={{selected:on}} accessibilityLabel={`${t[f]} ${counts[f]}`} onPress={()=>setBucket(f)} style={[s.chip,on&&s.chipOn]}>
            <Txt lang={lang} style={[s.chipText,on&&s.chipTextOn]}>{t[f]} {counts[f]}</Txt>
          </Pressable>;})}
        </ScrollView>
      </View>
    </View>
  </View>;
}

const s=StyleSheet.create({
  fill:{flex:1,backgroundColor:colors.background},
  scroll:{paddingHorizontal:space.lg,gap:space.lg},
  header:{position:'absolute',top:0,left:0,right:0,overflow:'hidden'},
  headerLine:{position:'absolute',bottom:0,left:0,right:0,height:layout.hairline,backgroundColor:colors.line},
  headerInner:{paddingHorizontal:space.lg,paddingTop:space.md,paddingBottom:space.md,gap:space.sm},
  largeTitle:{fontSize:type.largeTitle,lineHeight:type.largeTitle*1.25,fontWeight:'800'},
  subtitle:{fontSize:type.subhead,color:colors.muted,marginTop:-space.xs},
  search:{minHeight:40,alignItems:'center',gap:space.sm,paddingHorizontal:space.md,borderRadius:radius.control,backgroundColor:'rgba(118,102,91,0.12)'},
  searchInput:{flex:1,minWidth:0,minHeight:layout.minTouch-4,fontSize:type.callout,color:colors.ink},
  chipsScroll:{flexGrow:0},
  chips:{gap:space.sm,paddingVertical:2},
  chip:{minHeight:34,paddingHorizontal:space.md+2,borderRadius:radius.pill,backgroundColor:'rgba(255,255,255,0.7)',borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center'},
  chipOn:{backgroundColor:colors.brand,borderColor:colors.brand},
  chipText:{fontSize:type.footnote,fontWeight:'600',color:colors.ink},chipTextOn:{color:'#FFFFFF'},
  card:{backgroundColor:colors.white,borderRadius:radius.card,borderWidth:layout.hairline,borderColor:colors.line,...shadow},
  cardMain:{padding:space.lg+2,gap:space.sm+2},
  row:{alignItems:'flex-start',justifyContent:'space-between',gap:space.md},
  cardTitle:{flex:1,fontSize:type.headline,lineHeight:type.headline*1.35,fontWeight:'700'},
  badge:{borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:5},
  badgeText:{fontSize:type.caption,fontWeight:'700'},
  meta:{fontSize:type.footnote,color:colors.muted},
  dots:{gap:6,paddingVertical:2},dot:{flex:1,height:5,borderRadius:3,backgroundColor:'#E3D8C6'},
  what:{fontSize:type.subhead,lineHeight:type.subhead*1.5,color:colors.muted},
  whatNeed:{color:'#8A4F0B',backgroundColor:'#FFF4DC',borderRadius:12,padding:space.md,overflow:'hidden',fontWeight:'600'},
  footer:{alignItems:'center',justifyContent:'space-between',borderTopWidth:layout.hairline,borderColor:colors.line,paddingHorizontal:space.lg+2,minHeight:layout.minTouch},
  actionPill:{minHeight:34,paddingHorizontal:space.md+2,borderRadius:radius.pill,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center'},
  actionText:{fontSize:type.footnote,fontWeight:'700',color:colors.ink},
  detailsLink:{alignItems:'center',gap:6,minHeight:layout.minTouch,paddingHorizontal:space.xs},
  detailsText:{fontSize:type.subhead,fontWeight:'600',color:colors.brand},
  notice:{alignItems:'center',gap:space.sm,padding:space.md,borderRadius:14,backgroundColor:'#FFF4DC'},
  noticeText:{flex:1,fontSize:type.footnote,color:'#8A4F0B'},
  retry:{paddingHorizontal:space.sm,minHeight:layout.minTouch-8,justifyContent:'center'},retryText:{fontSize:type.footnote,fontWeight:'700',color:colors.brand},
  empty:{alignItems:'center',gap:space.md,paddingVertical:space.xxl*1.5,paddingHorizontal:space.lg},
  emptyIcon:{width:72,height:72,borderRadius:36,backgroundColor:colors.brandTint,alignItems:'center',justifyContent:'center'},
  emptyTitle:{fontSize:type.title2,fontWeight:'700',textAlign:'center'},
  emptyBody:{fontSize:type.callout,lineHeight:type.callout*1.5,color:colors.muted,textAlign:'center'},
  startBtn:{minHeight:52,borderRadius:14,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',paddingHorizontal:space.xxl,marginTop:space.sm},
  startText:{fontSize:type.headline,fontWeight:'700'},
  pullHint:{fontSize:type.caption,color:colors.muted,marginTop:space.sm,textAlign:'center'},
  section:{gap:space.sm},sectionTitle:{fontSize:type.subhead,fontWeight:'700',color:colors.muted},
  draft:{alignItems:'center',gap:space.md,minHeight:layout.minTouch,paddingHorizontal:space.lg,borderRadius:14,backgroundColor:colors.white,borderWidth:layout.hairline,borderColor:colors.line},
  draftText:{flex:1,fontSize:type.callout},
  demoLink:{alignSelf:'center',minHeight:layout.minTouch,justifyContent:'center'},demoText:{fontSize:type.footnote,color:colors.muted,textDecorationLine:'underline'},
  skelLine1:{height:20,width:'70%',borderRadius:8,backgroundColor:'#E9DACC',margin:space.lg+2,marginBottom:0},
  skelLine2:{height:14,width:'45%',borderRadius:7,backgroundColor:'#EFE3D4',marginHorizontal:space.lg+2},
  skelDots:{height:5,borderRadius:3,backgroundColor:'#EFE3D4',margin:space.lg+2,marginTop:space.sm},
});
