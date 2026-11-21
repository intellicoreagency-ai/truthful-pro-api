/**
 * Home — glass redesign. Approved artwork stays (Dubai photo, illustrations cropped from the approved home reference);
 * every word is real text now (screen readers, font scale, RTL), in Arabic as well as English.
 */
import React,{useState} from 'react';
import {Image,ImageBackground,Linking,Platform,StyleSheet,TextInput,View} from 'react-native';
import {BlurView} from 'expo-blur';
import {Pressable} from './Touch';
import {Icon} from './Icons';
import {ContactGlyph,RefSprite,officialLogo} from './ReferenceUI';
import {Txt,type Lang} from './ui/Txt';
import {GlassButton,GlassCard,GlassScreen,g,rowFor,useReduceTransparency} from './ui/Glass';
import {colors,layout,onGlass,radius,space,type} from './theme';

type Props={lang:Lang;onLanguage:()=>void;onServices:(business:boolean)=>void;onSearch:(query:string)=>void;onNotifications:()=>void;alerts?:boolean};
const home=require('../assets/design-references/home.png');
const hero=require('../assets/brand/dubai_hero.webp');
const SUPPORT_WHATSAPP='https://wa.me/971585144005';
const SUPPORT_PHONE='tel:+971525949522';

const COPY={
  ar:{brand:'تروثفل برو',tagline:'خدمات تخليص المعاملات',language:'English',languageA11y:'التبديل إلى الإنجليزية',
    notifications:'الإشعارات',notificationsAlert:'الإشعارات، توجد معاملة تحتاج إجراءً منك',
    welcome:'مرحباً بك في تروثفل',lead:'معاملاتك تبدأ بخطوة واضحة',search:'ابحث عن خدمة أو معاملة',searchGo:'بحث',
    heroTitle:'نقرّب لك الإجراءات',heroBody:'خدمات تخليص المعاملات للأفراد والشركات',heroA11y:'متحف المستقبل وأفق دبي',
    individuals:'خدمات الأفراد',individualsBody:'لك ولعائلتك',business:'خدمات الشركات',businessBody:'لأعمالك ومنشأتك',
    help:'تحتاج مساعدة في اختيار الخدمة؟',helpBody:'تواصل مع أحد مستشارينا وفالك طيب.',whatsapp:'واتساب',call:'اتصال',
    contactError:'تعذّر فتح التطبيق. اتصل بنا على ‎+971 52 594 9522'},
  en:{brand:'TRUTHFUL PRO',tagline:'Document clearance services',language:'ع',languageA11y:'Switch to Arabic',
    notifications:'Notifications',notificationsAlert:'Notifications, a request needs your action',
    welcome:'Welcome to TRUTHFUL',lead:'Your next step, made clear',search:'Search for a service',searchGo:'Search',
    heroTitle:'Making procedures simpler',heroBody:'Document clearing services for individuals and businesses',heroA11y:'Museum of the Future and Dubai skyline',
    individuals:'Individual Services',individualsBody:'For you and your family',business:'Business Services',businessBody:'For your business',
    help:'Need help choosing a service?',helpBody:'Speak to an adviser. We’re here to help.',whatsapp:'WhatsApp',call:'Call us',
    contactError:'Could not open the app. Call us on +971 52 594 9522.'},
} as const;

/** Illustration crops of the approved home reference (artwork only, no text). */
type Box=[number,number,number,number];
const ART:{individuals:Box;business:Box;support:Box}={individuals:[665,760,160,145],business:[666,966,160,145],support:[695,1209,120,143]};

export function HomeScreen({lang,onLanguage,onServices,onSearch,onNotifications,alerts=false}:Props){
  const t=COPY[lang],ar=lang==='ar',row=rowFor(lang);
  const reduce=useReduceTransparency();
  const [query,setQuery]=useState('');
  const [contactError,setContactError]=useState(false);
  const search=()=>{const q=query.trim();onSearch(q);setQuery('')};
  const contact=async(url:string)=>{setContactError(false);try{await Linking.openURL(url)}catch{setContactError(true)}};

  return <GlassScreen>
    {/* Brand bar */}
    <View style={[styles.brandBar,{flexDirection:row}]}>
      <Image source={officialLogo} style={styles.logo} accessibilityIgnoresInvertColors accessible={false}/>
      <View style={g.flex1} accessibilityRole="header">
        <Txt lang={lang} bold style={styles.brand}>{t.brand}</Txt>
        <Txt lang={lang} style={g.meta}>{t.tagline}</Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.languageA11y} onPress={onLanguage} style={styles.round}>
        <Txt lang={ar?'en':'ar'} bold style={styles.languageText}>{ar?'EN':t.language}</Txt>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={alerts?t.notificationsAlert:t.notifications} onPress={onNotifications} style={styles.round}>
        <Icon name="bell" size={22} color={colors.ink}/>
        {alerts&&<View style={styles.alertDot}/>}
      </Pressable>
    </View>

    {/* Welcome */}
    <View style={styles.welcome}>
      <Txt lang={lang} bold style={styles.welcomeTitle}>{t.welcome}</Txt>
      <Txt lang={lang} style={styles.lead}>{t.lead}</Txt>
    </View>

    {/* Search → services catalogue */}
    <View style={[styles.search,{flexDirection:row}]}>
      <Icon name="search" size={20} color={colors.muted}/>
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" value={query} onChangeText={setQuery}
        accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor={onGlass.placeholder} returnKeyType="search" onSubmitEditing={search}
        style={[styles.searchInput,{textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr',fontFamily:ar?'CairoRegular':undefined}]}/>
      {!!query.trim()&&<GlassButton lang={lang} compact primary label={t.searchGo} onPress={search}/>}
    </View>

    {/* Hero: approved Dubai photo with a glass caption */}
    <ImageBackground source={hero} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage} accessible accessibilityRole="image" accessibilityLabel={t.heroA11y}>
      <View style={[styles.heroCaption,ar?{right:space.md}:{left:space.md}]}>
        {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={50} experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
        <View style={[styles.heroCaptionInner,reduce&&styles.heroCaptionOpaque]}>
          <Txt lang={lang} bold style={styles.heroTitle}>{t.heroTitle}</Txt>
          <Txt lang={lang} style={styles.heroBody}>{t.heroBody}</Txt>
        </View>
      </View>
    </ImageBackground>

    {/* Service shortcuts */}
    {([false,true] as const).map(business=>{
      const title=business?t.business:t.individuals,body=business?t.businessBody:t.individualsBody;
      return <Pressable key={String(business)} accessibilityRole="button" accessibilityLabel={`${title}${ar?'، ':', '}${body}`} onPress={()=>onServices(business)} style={styles.servicePress}>
        <GlassCard reduce={reduce}>
          <View style={[styles.service,{flexDirection:row}]}>
            <View style={styles.serviceArt}><RefSprite source={home} sourceWidth={864} sourceHeight={1536} bounds={business?ART.business:ART.individuals} style={styles.sprite}/></View>
            <View style={g.flex1}>
              <Txt lang={lang} bold style={styles.serviceTitle}>{title}</Txt>
              <Txt lang={lang} style={g.body}>{body}</Txt>
            </View>
            <Icon name={ar?'back':'next'} size={22} color={colors.brand}/>
          </View>
        </GlassCard>
      </Pressable>;
    })}

    {/* Help */}
    <GlassCard reduce={reduce}>
      <View style={[styles.help,{flexDirection:row}]}>
        <View style={styles.helpArt}><RefSprite source={home} sourceWidth={864} sourceHeight={1536} bounds={ART.support} style={styles.sprite}/></View>
        <View style={g.flex1}>
          <Txt lang={lang} bold style={styles.serviceTitle}>{t.help}</Txt>
          <Txt lang={lang} style={g.body}>{t.helpBody}</Txt>
        </View>
      </View>
      <View style={[styles.contactRow,{flexDirection:row}]}>
        {([true,false] as const).map(wa=><Pressable key={String(wa)} accessibilityRole="link" accessibilityLabel={wa?t.whatsapp:t.call}
          onPress={()=>void contact(wa?SUPPORT_WHATSAPP:SUPPORT_PHONE)} style={[styles.contact,{flexDirection:row}]}>
          <ContactGlyph whatsapp={wa} size={24}/>
          <Txt lang={lang} bold style={styles.contactText}>{wa?t.whatsapp:t.call}</Txt>
        </Pressable>)}
      </View>
      {contactError&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={{...g.noteText,color:colors.danger,textAlign:'center'}}>{t.contactError}</Txt></View>}
    </GlassCard>
  </GlassScreen>;
}

const styles=StyleSheet.create({
  brandBar:{alignItems:'center',gap:space.md},
  logo:{width:52,height:52,borderRadius:26},
  brand:{fontSize:type.title2,lineHeight:30},
  round:{width:layout.minTouch+2,height:layout.minTouch+2,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:onGlass.field,borderWidth:1,borderColor:onGlass.border,overflow:'hidden'},
  languageText:{fontSize:type.callout,color:colors.brand},
  alertDot:{position:'absolute',top:9,right:10,width:10,height:10,borderRadius:5,backgroundColor:colors.orange,borderWidth:1.5,borderColor:colors.white},
  welcome:{gap:2,alignItems:'center'},
  welcomeTitle:{fontSize:type.title,lineHeight:42,textAlign:'center'},
  lead:{fontSize:type.callout,lineHeight:24,color:colors.muted,textAlign:'center'},
  search:{alignItems:'center',gap:space.sm,minHeight:layout.minTouch+8,paddingHorizontal:space.md,borderRadius:radius.card,borderWidth:1,borderColor:onGlass.border,
    backgroundColor:'rgba(255,255,255,0.7)'},
  searchInput:{flex:1,minHeight:layout.minTouch,fontSize:type.callout,color:colors.ink},
  hero:{height:220,justifyContent:'flex-end',borderRadius:radius.card+8,overflow:'hidden'},
  heroImage:{borderRadius:radius.card+8},
  heroCaption:{position:'absolute',bottom:space.md,maxWidth:'78%',borderRadius:radius.card,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.7)'},
  heroCaptionInner:{padding:space.md,gap:2,backgroundColor:'rgba(255,249,244,0.55)'},
  heroCaptionOpaque:{backgroundColor:colors.white},
  heroTitle:{fontSize:type.title2,lineHeight:32},
  heroBody:{fontSize:type.footnote+1,lineHeight:20,color:onGlass.soft},
  servicePress:{borderRadius:radius.card+8},
  service:{alignItems:'center',gap:space.md},
  serviceArt:{width:76,borderRadius:radius.control+4,overflow:'hidden'},
  helpArt:{width:56,borderRadius:radius.control,overflow:'hidden'},
  sprite:{width:'100%'},
  serviceTitle:{fontSize:type.headline,lineHeight:26},
  help:{alignItems:'center',gap:space.md},
  contactRow:{gap:space.md},
  contact:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center',gap:space.sm,borderRadius:16,borderWidth:1,borderColor:'#D6B36A',
    backgroundColor:'rgba(255,249,244,0.9)',overflow:'hidden'},
  contactText:{fontSize:type.subhead},
});
