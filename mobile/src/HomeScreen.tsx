/**
 * Home — premium concierge design.
 * Full-bleed live Dubai Marina photo hero (src/ui/LiveHero.tsx: slow Ken Burns drift) with parallax (moves at ~40% of scroll, stretches on pull-down), glass controls over the photo,
 * a floating glass search, a gold display headline, staggered service cards and a dark espresso concierge card.
 * Approved artwork kept (Dubai photo, illustrations cropped from the approved home reference). Every word is real text.
 * Motion respects Reduce motion; glass falls back to opaque under Reduce transparency.
 */
import React,{useState} from 'react';
import {Image,Linking,Platform,StyleSheet,TextInput,View} from 'react-native';
import Animated,{Extrapolation,interpolate,useAnimatedScrollHandler,useAnimatedStyle,useReducedMotion,useSharedValue} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {Icon} from './Icons';
import {ContactGlyph,RefSprite,officialLogo} from './ReferenceUI';
import {Txt,type Lang} from './ui/Txt';
import {rowFor,useReduceTransparency} from './ui/Glass';
import {Entrance,GoldBadge,GoldText,LuxCard,ScalePressable} from './ui/Premium';
import {useTabBarHeight} from './navigation/TabBarLayout';
import {colors,layout,lux,radius,space,type} from './theme';
import {LanguageButton} from './ui/LanguageButton';
import {LiveHero} from './ui/LiveHero';
import {pick} from './i18n';

type Props={lang:Lang;onLanguage:()=>void;onServices:(business:boolean)=>void;onSearch:(query:string)=>void;onNotifications:()=>void;alerts?:boolean};
const home=require('../assets/design-references/home.jpg');
const SUPPORT_WHATSAPP='https://wa.me/971585144005';
const SUPPORT_PHONE='tel:+971525949522';
const HERO=340;

const COPY={
  ar:{brand:'تروثفل برو',tagline:'خدمات تخليص المعاملات',languageA11y:'التبديل إلى الإنجليزية',
    notifications:'الإشعارات',notificationsAlert:'الإشعارات، توجد معاملة تحتاج إجراءً منك',
    welcome:'مرحباً بك في تروثفل',heroTitle:'نقرّب لك الإجراءات',heroBody:'خدمات تخليص المعاملات للأفراد والشركات في دبي، بعناية واهتمام.',heroA11y:'مرسى دبي وأفق المدينة عند الغروب',
    search:'ابحث عن خدمة أو معاملة',searchGo:'بحث',services:'خدماتنا',
    individuals:'خدمات الأفراد',individualsBody:'الإقامات، الهوية، الأسرة، والمزيد لك ولعائلتك',
    business:'خدمات الشركات',businessBody:'الرخص، التأسيس، العمالة، وخدمات منشأتك',
    concierge:'مستشارك الخاص',help:'تحتاج مساعدة في اختيار الخدمة؟',helpBody:'تواصل مع أحد مستشارينا وفالك طيب.',whatsapp:'واتساب',call:'اتصال',
    contactError:'تعذّر فتح التطبيق. اتصل بنا على ‎+971 52 594 9522'},
  en:{brand:'TRUTHFUL PRO',tagline:'Document clearance services',languageA11y:'Switch to Arabic',
    notifications:'Notifications',notificationsAlert:'Notifications, a request needs your action',
    welcome:'Welcome to TRUTHFUL',heroTitle:'Making procedures simpler',heroBody:'Document clearance for individuals and businesses in Dubai, handled with care.',heroA11y:'Dubai Marina and the city skyline at dusk',
    search:'Search for a service',searchGo:'Search',services:'Our services',
    individuals:'Individual Services',individualsBody:'Residency, Emirates ID, family and more for you and yours',
    business:'Business Services',businessBody:'Licences, company setup, labour and services for your business',
    concierge:'Your personal adviser',help:'Need help choosing a service?',helpBody:'Speak to an adviser. We’re here to help.',whatsapp:'WhatsApp',call:'Call us',
    contactError:'Could not open the app. Call us on +971 52 594 9522.'},
  ru:{tagline:'Услуги по оформлению документов',languageA11y:'Сменить язык',
    notifications:'Уведомления',notificationsAlert:'Уведомления: запрос требует вашего действия',
    welcome:'Добро пожаловать в TRUTHFUL',heroTitle:'Упрощаем процедуры',heroBody:'Оформление документов для частных лиц и компаний в Дубае — внимательно и надёжно.',heroA11y:'Дубай Марина и панорама города на закате',
    search:'Поиск услуги',searchGo:'Найти',services:'Наши услуги',
    individuals:'Услуги для частных лиц',individualsBody:'ВНЖ, Emirates ID, семья и многое другое для вас и ваших близких',
    business:'Услуги для компаний',businessBody:'Лицензии, регистрация компании, персонал и другие услуги для бизнеса',
    concierge:'Ваш личный консультант',help:'Нужна помощь с выбором услуги?',helpBody:'Свяжитесь с консультантом — мы поможем.',whatsapp:'WhatsApp',call:'Позвонить',
    contactError:'Не удалось открыть приложение. Позвоните нам: +971 52 594 9522.'},
  zh:{tagline:'文件清关服务',languageA11y:'切换语言',
    notifications:'通知',notificationsAlert:'通知：有一项申请需要您处理',
    welcome:'欢迎来到 TRUTHFUL',heroTitle:'让办事更简单',heroBody:'为迪拜的个人与企业提供细致可靠的文件清关服务。',heroA11y:'黄昏时分的迪拜码头与城市天际线',
    search:'搜索服务',searchGo:'搜索',services:'我们的服务',
    individuals:'个人服务',individualsBody:'居留、阿联酋身份证、家庭团聚等，为您和家人办理',
    business:'企业服务',businessBody:'执照、公司注册、劳工及其他企业服务',
    concierge:'您的专属顾问',help:'需要帮助选择服务吗？',helpBody:'联系我们的顾问，我们随时为您服务。',whatsapp:'WhatsApp',call:'致电我们',
    contactError:'无法打开应用。请致电 +971 52 594 9522。'},
  fr:{tagline:'Services de formalités administratives',languageA11y:'Changer de langue',
    notifications:'Notifications',notificationsAlert:'Notifications : une demande requiert votre action',
    welcome:'Bienvenue chez TRUTHFUL',heroTitle:'Des démarches simplifiées',heroBody:'Formalités administratives pour particuliers et entreprises à Dubaï, traitées avec soin.',heroA11y:'Dubai Marina et la ligne d’horizon au crépuscule',
    search:'Rechercher un service',searchGo:'Rechercher',services:'Nos services',
    individuals:'Services aux particuliers',individualsBody:'Résidence, Emirates ID, famille et plus pour vous et vos proches',
    business:'Services aux entreprises',businessBody:'Licences, création de société, main-d’œuvre et services pour votre entreprise',
    concierge:'Votre conseiller personnel',help:'Besoin d’aide pour choisir un service ?',helpBody:'Parlez à un conseiller, nous sommes là pour vous aider.',whatsapp:'WhatsApp',call:'Nous appeler',
    contactError:'Impossible d’ouvrir l’application. Appelez-nous au +971 52 594 9522.'},
  es:{tagline:'Servicios de trámites y documentación',languageA11y:'Cambiar idioma',
    notifications:'Notificaciones',notificationsAlert:'Notificaciones: una solicitud requiere su acción',
    welcome:'Bienvenido a TRUTHFUL',heroTitle:'Trámites más sencillos',heroBody:'Gestión de documentos para particulares y empresas en Dubái, con esmero y confianza.',heroA11y:'Dubai Marina y el horizonte de la ciudad al atardecer',
    search:'Buscar un servicio',searchGo:'Buscar',services:'Nuestros servicios',
    individuals:'Servicios para particulares',individualsBody:'Residencia, Emirates ID, familia y más para usted y los suyos',
    business:'Servicios para empresas',businessBody:'Licencias, constitución de empresas, personal y servicios para su negocio',
    concierge:'Su asesor personal',help:'¿Necesita ayuda para elegir un servicio?',helpBody:'Hable con un asesor. Estamos para ayudarle.',whatsapp:'WhatsApp',call:'Llámenos',
    contactError:'No se pudo abrir la aplicación. Llámenos al +971 52 594 9522.'},
} as const;

/** Illustration crops of the approved home reference (artwork only, no text). */
type Box=[number,number,number,number];
const ART:{individuals:Box;business:Box}={individuals:[665,760,160,145],business:[666,966,160,145]};

/** Round glass control over the photo (dark material, light glyph). */
function PhotoButton({label,onPress,children,reduce}:{label:string;onPress:()=>void;children:React.ReactNode;reduce:boolean}){
  return <ScalePressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} rippleColor="rgba(255,255,255,0.25)" style={styles.photoButton}>
    {!reduce&&<BlurView pointerEvents="none" tint="dark" intensity={40} experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,reduce?styles.photoButtonOpaque:styles.photoButtonTint]}/>
    {/* own layer so it paints above the backdrop on every platform (web stacks bare SVG under positioned layers) */}
    <View pointerEvents="none">{children}</View>
  </ScalePressable>;
}

export function HomeScreen({lang,onLanguage,onServices,onSearch,onNotifications,alerts=false}:Props){
  const t=pick(COPY,lang),ar=lang==='ar',row=rowFor(lang);
  const reduce=useReduceTransparency();
  const reduceMotion=useReducedMotion();
  const tabBar=useTabBarHeight();
  const [query,setQuery]=useState('');
  const [contactError,setContactError]=useState(false);
  const search=()=>{const q=query.trim();if(!q)return;onSearch(q);setQuery('')};
  const contact=async(url:string)=>{setContactError(false);try{await Linking.openURL(url)}catch{setContactError(true)}};

  // Parallax: the photo moves slower than the page and stretches when pulled down.
  const y=useSharedValue(0);
  const onScroll=useAnimatedScrollHandler(e=>{y.value=e.contentOffset.y});
  const heroImage=useAnimatedStyle(()=>reduceMotion?{}:{transform:[
    {translateY:interpolate(y.value,[-HERO,0,HERO],[-HERO/2,0,HERO*0.4],Extrapolation.CLAMP)},
    {scale:interpolate(y.value,[-HERO,0],[1.8,1],Extrapolation.CLAMP)},
  ]});
  const heroChrome=useAnimatedStyle(()=>({opacity:interpolate(y.value,[0,HERO*0.6],[1,0],Extrapolation.CLAMP)}));

  return <View style={styles.screen}>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{paddingBottom:tabBar+space.xl}} scrollIndicatorInsets={{bottom:tabBar}}>

      {/* Hero */}
      <View style={styles.hero} accessible accessibilityRole="image" accessibilityLabel={t.heroA11y}>
        <Animated.View style={[StyleSheet.absoluteFill,styles.heroImage,heroImage]}><LiveHero/></Animated.View>
        <LinearGradient pointerEvents="none" colors={['rgba(10,20,48,0.62)','rgba(10,20,48,0)']} style={styles.topScrim}/>
        <LinearGradient pointerEvents="none" colors={['rgba(243,245,248,0)','rgba(243,245,248,0.85)',lux.ivory]} locations={[0,0.7,1]} style={styles.bottomFade}/>
      </View>

      {/* Brand bar over the photo */}
      <Animated.View style={[styles.brandBar,{flexDirection:row},heroChrome]}>
        <View style={styles.logoRing}><LinearGradient colors={lux.goldBright} style={styles.logoRingFill}><Image source={officialLogo} style={styles.logo} accessible={false}/></LinearGradient></View>
        <View style={styles.flex1} accessibilityRole="header">
          <Txt lang={lang} bold numberOfLines={1} style={styles.brand}>{t.brand}</Txt>
          <Txt lang={lang} numberOfLines={1} style={styles.tagline}>{t.tagline}</Txt>
        </View>
        <LanguageButton lang={lang} onPress={onLanguage} tone="dark"/>
        <PhotoButton label={alerts?t.notificationsAlert:t.notifications} onPress={onNotifications} reduce={reduce}>
          <Icon name="bell" size={21} color={lux.onDark}/>
          {alerts&&<View style={styles.alertDot}/>}
        </PhotoButton>
      </Animated.View>

      <View style={styles.body}>
        {/* Floating search */}
        <Entrance index={0}>
          <LuxCard reduce={reduce} radius={22} contentStyle={[styles.search,{flexDirection:row}]}>
            <Icon name="search" size={20} color={colors.brand}/>
            <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" value={query} onChangeText={setQuery}
              accessibilityLabel={t.search} placeholder={t.search} placeholderTextColor="rgba(14,21,38,0.5)" returnKeyType="search" onSubmitEditing={search}
              style={[styles.searchInput,{textAlign:ar?'right':'left',writingDirection:ar?'rtl':'ltr',fontFamily:ar?'CairoRegular':undefined}]}/>
            <ScalePressable accessibilityRole="button" accessibilityLabel={t.searchGo} accessibilityState={{disabled:!query.trim()}} disabled={!query.trim()} onPress={search}
              style={[styles.searchGo,!query.trim()&&styles.dim]} rippleColor="rgba(255,255,255,0.3)">
              <LinearGradient colors={lux.orangeDeep} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
              <View pointerEvents="none"><Icon name={ar?'back':'next'} size={20} color="#FFFFFF"/></View>
            </ScalePressable>
          </LuxCard>
        </Entrance>

        {/* Headline */}
        <Entrance index={1} style={styles.headline}>
          <Txt lang={lang} bold style={styles.eyebrow}>{t.welcome}</Txt>
          <GoldText lang={lang} style={styles.title}>{t.heroTitle}</GoldText>
          <Txt lang={lang} style={styles.lead}>{t.heroBody}</Txt>
        </Entrance>

        {/* Services */}
        <Entrance index={2}><View accessibilityRole="header"><Txt lang={lang} bold style={styles.section}>{t.services}</Txt></View></Entrance>
        {([false,true] as const).map((business,i)=>{
          const title=business?t.business:t.individuals,body=business?t.businessBody:t.individualsBody;
          return <Entrance key={String(business)} index={3+i}>
            <ScalePressable accessibilityRole="button" accessibilityLabel={`${title}${ar?'، ':', '}${body}`} onPress={()=>onServices(business)} style={styles.servicePress}>
              <LuxCard reduce={reduce} contentStyle={[styles.service,{flexDirection:row}]}>
                <LinearGradient colors={lux.goldBadge} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.artFrame}>
                  <View style={styles.art}><RefSprite source={home} sourceWidth={864} sourceHeight={1536} bounds={business?ART.business:ART.individuals} style={styles.sprite}/></View>
                </LinearGradient>
                <View style={[styles.flex1,styles.serviceText]}>
                  <Txt lang={lang} bold style={styles.serviceTitle}>{title}</Txt>
                  <Txt lang={lang} style={styles.serviceBody}>{body}</Txt>
                </View>
                <GoldBadge icon={ar?'back':'next'} size={36}/>
              </LuxCard>
            </ScalePressable>
          </Entrance>;
        })}

        {/* Concierge */}
        <Entrance index={5}>
          <View style={styles.conciergeShadow}>
            <LinearGradient colors={lux.goldBright} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.conciergeBorder}>
              <LinearGradient colors={[lux.espressoSoft,lux.espresso]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.concierge}>
                <View style={[styles.conciergeHead,{flexDirection:row}]}>
                  <LinearGradient colors={lux.goldBright} style={styles.supportFrame}>
                    <View style={styles.supportArt}><Icon name="headset" size={32} color={lux.goldText[1]}/></View>
                  </LinearGradient>
                  <View style={[styles.flex1,styles.serviceText]}>
                    <GoldText lang={lang} colors={lux.goldBright} style={styles.conciergeEyebrow}>{t.concierge}</GoldText>
                    <Txt lang={lang} bold style={styles.conciergeTitle}>{t.help}</Txt>
                    <Txt lang={lang} style={styles.conciergeBody}>{t.helpBody}</Txt>
                  </View>
                </View>
                <View style={[styles.contactRow,{flexDirection:row}]}>
                  {([true,false] as const).map(wa=><View key={String(wa)} style={styles.flex1}>
                    <ScalePressable accessibilityRole="link" accessibilityLabel={wa?t.whatsapp:t.call} onPress={()=>void contact(wa?SUPPORT_WHATSAPP:SUPPORT_PHONE)}
                      rippleColor="rgba(255,255,255,0.2)" style={[styles.contact,{flexDirection:row}]}>
                      <ContactGlyph whatsapp={wa} size={24}/>
                      <Txt lang={lang} bold style={styles.contactText}>{wa?t.whatsapp:t.call}</Txt>
                    </ScalePressable>
                  </View>)}
                </View>
                {contactError&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={styles.contactError}>{t.contactError}</Txt></View>}
              </LinearGradient>
            </LinearGradient>
          </View>
        </Entrance>
      </View>
    </Animated.ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:lux.ivory},
  flex1:{flex:1},
  dim:{opacity:0.45},

  hero:{height:HERO,overflow:'hidden',backgroundColor:lux.espresso},
  heroImage:{width:'100%',height:HERO},
  topScrim:{position:'absolute',top:0,left:0,right:0,height:150},
  bottomFade:{position:'absolute',bottom:0,left:0,right:0,height:64},

  brandBar:{position:'absolute',top:space.md,left:space.lg,right:space.lg,alignItems:'center',gap:space.md},
  logoRing:{borderRadius:30,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.3,shadowRadius:10,shadowOffset:{width:0,height:4}},android:{elevation:6},default:{}}) as object},
  logoRingFill:{width:54,height:54,borderRadius:27,alignItems:'center',justifyContent:'center'},
  logo:{width:48,height:48,borderRadius:24},
  brand:{fontSize:type.title2-2,lineHeight:28,color:lux.onDark},
  tagline:{fontSize:type.footnote,lineHeight:18,color:lux.onDarkSoft},
  photoButton:{width:layout.minTouch+2,height:layout.minTouch+2,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',overflow:'hidden',
    borderWidth:1,borderColor:'rgba(232,211,162,0.45)'},
  photoButtonTint:{backgroundColor:'rgba(10,20,48,0.28)'},
  photoButtonOpaque:{backgroundColor:'rgba(10,20,48,0.85)'},
  photoButtonText:{fontSize:type.callout,color:lux.onDark},
  alertDot:{position:'absolute',top:-3,right:-3,width:10,height:10,borderRadius:5,backgroundColor:colors.gold,borderWidth:1.5,borderColor:lux.onDark},

  body:{marginTop:-56,paddingHorizontal:space.lg+2,gap:space.lg,width:'100%',maxWidth:600,alignSelf:'center'},
  search:{alignItems:'center',gap:space.sm,minHeight:60,paddingHorizontal:space.md,paddingVertical:6},
  searchInput:{flex:1,minHeight:layout.minTouch,fontSize:type.callout,color:colors.ink},
  searchGo:{width:layout.minTouch,height:layout.minTouch,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',overflow:'hidden'},

  headline:{gap:space.xs,paddingTop:space.xs},
  eyebrow:{fontSize:type.subhead,lineHeight:22,color:colors.brand},
  title:{fontSize:34,lineHeight:44},
  lead:{fontSize:type.callout,lineHeight:26,color:colors.muted},

  section:{fontSize:type.title2,lineHeight:30,marginTop:space.sm},
  servicePress:{borderRadius:radius.card+10},
  service:{alignItems:'center',gap:space.md,padding:space.md},
  serviceText:{gap:2},
  artFrame:{width:84,height:84,borderRadius:22,padding:2},
  art:{flex:1,borderRadius:20,overflow:'hidden',backgroundColor:lux.ivory,justifyContent:'center'},
  sprite:{width:'100%'},
  serviceTitle:{fontSize:type.headline,lineHeight:26},
  serviceBody:{fontSize:type.footnote+1,lineHeight:20,color:colors.muted},

  conciergeShadow:{borderRadius:radius.card+10,...Platform.select({ios:{shadowColor:lux.espresso,shadowOpacity:0.35,shadowRadius:26,shadowOffset:{width:0,height:16}},android:{elevation:10},default:{shadowColor:lux.espresso,shadowOpacity:0.35,shadowRadius:26,shadowOffset:{width:0,height:16}}}) as object},
  conciergeBorder:{borderRadius:radius.card+10,padding:1.2},
  concierge:{borderRadius:radius.card+9,padding:space.xl,gap:space.lg},
  conciergeHead:{alignItems:'center',gap:space.md},
  supportFrame:{width:68,height:68,borderRadius:34,padding:2},
  supportArt:{flex:1,borderRadius:32,overflow:'hidden',backgroundColor:lux.ivory,alignItems:'center',justifyContent:'center'},
  conciergeEyebrow:{fontSize:type.footnote+1,lineHeight:20},
  conciergeTitle:{fontSize:type.headline,lineHeight:26,color:lux.onDark},
  conciergeBody:{fontSize:type.footnote+1,lineHeight:20,color:lux.onDarkSoft},
  contactRow:{gap:space.md},
  contact:{minHeight:52,alignItems:'center',justifyContent:'center',gap:space.sm,borderRadius:16,borderWidth:1,borderColor:'rgba(217,188,126,0.6)',
    backgroundColor:'rgba(242,245,251,0.08)',overflow:'hidden'},
  contactText:{fontSize:type.subhead,color:lux.onDark},
  contactError:{fontSize:type.footnote+1,lineHeight:20,color:'#FFC9BD',textAlign:'center'},
});
