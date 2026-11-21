import React, {useMemo, useState} from 'react';
import {Alert, AppState, BackHandler, Image, Keyboard, Platform, StatusBar, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {colors as C} from './src/theme';
import {BlurTargetView} from 'expo-blur';
import {TabBar} from './src/navigation/TabBar';
import {TabBarLayoutProvider,ScrollView} from './src/navigation/TabBarLayout';
import {activeTab,showsTabBar,type TabKey} from './src/navigation/tabs';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {Cairo_400Regular,Cairo_600SemiBold,Cairo_700Bold} from '@expo-google-fonts/cairo';
import {IBMPlexSansArabic_500Medium} from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import {IBMPlexSansArabic_700Bold} from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import {PlusJakartaSans_500Medium} from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import {PlusJakartaSans_700Bold} from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import {SERVICES, catalogueServices, Service, serviceLabel, serviceDescription} from './src/services';
import {structureFor, wording} from './src/serviceDetails';
import {companyBannerFonts} from './src/CompanyBanner';
import {CategoryBanner} from './src/catalogue/CategoryBanner';
import {locate} from './src/catalogue/categories';
import {ClientWorkspace} from './src/ClientWorkspace';
import {RequestWizard} from './src/request/RequestWizard';
import {pickClientFile,pruneOrphanFiles,readRequests,writeRequests,getBytes,saveDataExport} from './src/clientStorage';
import {makeId,statusLabels,type ClientRequest,type ClientFile} from './src/clientModel';
import {HomeScreen} from './src/HomeScreen';
import {ServicesScreen} from './src/services/ServicesScreen';
import {ServiceDetailsScreen,StartRequestBar} from './src/services/ServiceDetailsScreen';
import {FallbackScreen} from './src/FallbackScreen';
import {AuthFlow} from './src/auth/AuthFlow';
import {NewRequestScreen} from './src/newRequest/NewRequestScreen';
import type {SyncStatus} from './src/dashboard/DashboardScreen';
import {ContactScreen} from './src/auth/ContactScreen';
import {AccountScreen} from './src/AccountScreen';
import {readAccount,saveAccount,emptyAccount,type AccountData} from './src/accountStorage';
import {LegalScreen} from './src/LegalScreen';
import {TERMS,PRIVACY} from './src/legal';
import {apiEnabled,hasSession,loadTokens,logout,me,pullRequests,pushRequest,needsSync,exportMyData,deleteAccount,setServerEmail,setSessionExpiredHandler} from './src/api';
import {LANGS,LANG_INFO,LANG_MENU_TITLE,LANG_NAMES,isLang,pick as pickCopy,tr} from './src/i18n';
import {SelectSheet} from './src/newRequest/SelectSheet';

type Language=import('./src/i18n').Lang;
type Page='welcome'|'home'|'services'|'detail'|'requests'|'profile'|'request'|'newrequest';
type DetailTab=import('./src/services/ServiceDetailsScreen').DetailTab;
type LocalFile={name:string;size?:number;uri:string;clientFile?:ClientFile};
type RequestDraft={
  name:string;
  phone:string;
  files:Record<string,LocalFile>;
  fields:Record<string,string>;
  saved?:boolean;
};
const fonts={
  CairoRegular:Cairo_400Regular,CairoSemiBold:Cairo_600SemiBold,CairoBold:Cairo_700Bold, // Arabic on the auth screens (English there uses the platform system font: SF Pro on iOS)
  ReferenceArabic:require('./assets/fonts/NotoSansArabic-Bold.ttf'),
  ...companyBannerFonts,
  ArabicMedium:IBMPlexSansArabic_500Medium,
  ArabicBold:IBMPlexSansArabic_700Bold,
  EnglishMedium:PlusJakartaSans_500Medium,
  EnglishBold:PlusJakartaSans_700Bold,
};
const font=(lang:Language,bold:boolean)=>({
  fontFamily:lang==='ar'?(bold?'ArabicBold':'ArabicMedium'):(bold?'EnglishBold':'EnglishMedium'),
  fontWeight:'normal' as const,
});
const emptyDraft:RequestDraft={name:'',phone:'',files:{},fields:{}};
const keyFor=(serviceId:string,actionId:string)=>serviceId+'/'+actionId;
const officialLogo=require('./assets/brand/truthful_official_logo.jpg');
// REJECTED_ASSET_QUARANTINE: no legacy service banner image is approved.
// Use a text-first warm espresso surface until each new unique banner is approved.
// The owner-approved asset registry is installed separately from 49 verified WebP cut-outs.
// Legacy banner assets remain quarantined and cannot return.

const copy={
  ar:{brand:'تروثفل برو',home:'الرئيسية',services:'الخدمات',request:'بدء معاملة',requests:'طلباتي',profile:'حسابي',
    welcome:'مرحباً بك في',intro:'شريكك الموثوق لإنجاز معاملاتك الحكومية بكل سهولة واحترافية.',
    individual:'الأفراد',company:'الشركات',search:'ابحث عن خدمة أو معاملة...',
    title:'خدمات الشركات',individualTitle:'خدمات الأفراد',details:'تفاصيل الخدمة',docs:'المستندات المطلوبة',fees:'الرسوم والمدة',
    about:'عن الخدمة',transactions:'أبرز المعاملات المتاحة',upload:'رفع الملف',start:'بدء الطلب',support:'الدعم',noRequests:'لا توجد مسودات محفوظة في هذه الجلسة',
    notLive:'هذه معاينة تصميم فقط. لا يتم إرسال مستندات أو معاملات حقيقية.',
    notice:'الرسوم الحكومية تُسدّد عبر الجهة الرسمية، وتُعرض رسوم خدمة تروثفل بشكل منفصل قبل الدفع.',
    languages:'English',choose:'اختر الخدمة',name:'الاسم الكامل',phone:'رقم الهاتف',next:'التالي',saved:'حفظ مسودة تجريبية'},
  en:{brand:'TRUTHFUL PRO',home:'Home',services:'Services',request:'Start Request',requests:'Requests',profile:'My Account',
    welcome:'Welcome to',intro:'Your trusted partner for government and business services across the UAE.',
    individual:'Individuals',company:'Companies',search:'Search for a service...',
    title:'Company Services',individualTitle:'Individual Services',details:'Service Details',docs:'Required Documents',fees:'Fees & Duration',
    about:'About this Service',transactions:'Main Transactions',upload:'Choose File',start:'Start Request',support:'Support',noRequests:'No saved drafts in this session',
    notLive:'Design preview only. No live documents or requests are submitted.',
    notice:'Government fees go to official authorities. TRUTHFUL handling fees are shown separately before payment.',
    languages:'العربية',choose:'Choose service',name:'Full name',phone:'Phone number',next:'Continue',saved:'Save Demo Draft'},
  ru:{home:'Главная',services:'Услуги',request:'Новая заявка',requests:'Заявки',profile:'Профиль',individual:'Частным лицам',company:'Компаниям',search:'Поиск услуги...',
    title:'Услуги для компаний',individualTitle:'Услуги для частных лиц',details:'Об услуге',docs:'Необходимые документы',fees:'Сборы и сроки',start:'Подать заявку',support:'Поддержка',choose:'Выберите услугу',name:'Полное имя',phone:'Телефон',next:'Далее'},
  zh:{home:'首页',services:'服务',request:'发起申请',requests:'我的申请',profile:'我的账户',individual:'个人',company:'企业',search:'搜索服务...',
    title:'企业服务',individualTitle:'个人服务',details:'服务详情',docs:'所需文件',fees:'费用与时长',start:'发起申请',support:'客服支持',choose:'选择服务',name:'全名',phone:'电话',next:'继续'},
  fr:{home:'Accueil',services:'Services',request:'Demande',requests:'Suivi',profile:'Compte',individual:'Particuliers',company:'Entreprises',search:'Rechercher un service...',
    title:'Services aux entreprises',individualTitle:'Services aux particuliers',details:'Détails du service',docs:'Documents requis',fees:'Frais et délais',start:'Faire une demande',support:'Assistance',choose:'Choisir un service',name:'Nom complet',phone:'Téléphone',next:'Continuer'},
  es:{home:'Inicio',services:'Servicios',request:'Solicitar',requests:'Solicitudes',profile:'Cuenta',individual:'Particulares',company:'Empresas',search:'Buscar un servicio...',
    title:'Servicios para empresas',individualTitle:'Servicios para particulares',details:'Detalles del servicio',docs:'Documentos necesarios',fees:'Tasas y plazos',start:'Iniciar solicitud',support:'Soporte',choose:'Elegir servicio',name:'Nombre completo',phone:'Teléfono',next:'Continuar'},
} as const;
function AppText({children,lang,style,numberOfLines}: {children:React.ReactNode,lang:Language,style?:any,numberOfLines?:number}) {
 const weight=StyleSheet.flatten(style)?.fontWeight;
 return <Text maxFontSizeMultiplier={1.35} numberOfLines={numberOfLines} style={[{textAlign:lang==='ar'?'right':'left',writingDirection:lang==='ar'?'rtl':'ltr',color:C.ink},style,font(lang,!!weight)]}>{children}</Text>;
}
function useWebViewportHeight() {
 const [height,setHeight]=useState<number>();
 React.useEffect(()=>{
   if(Platform.OS!=='web'||typeof window==='undefined') return;
   const viewport=window.visualViewport;
   const sync=()=>{
     if(viewport&&viewport.scale!==1) return;
     const available=Math.min(window.innerHeight,viewport?.height??window.innerHeight);
     if(available>0) setHeight(Math.floor(available));
   };
   sync();
   window.addEventListener('resize',sync);
   viewport?.addEventListener('resize',sync);
   return ()=>{
     window.removeEventListener('resize',sync);
     viewport?.removeEventListener('resize',sync);
   };
 },[]);
 return height;
}
// Alert.alert is a no-op on react-native-web; failures must still be visible in the web preview.
// Dynamic type / font scale is honoured on both platforms and capped (maxFontSizeMultiplier=1.35 on every Text/TextInput) so the approved layout survives very large system fonts.
const notify=(title:string,body?:string)=>{if(Platform.OS==='web'&&typeof window!=='undefined')window.alert(body?title+'\n'+body:title);else Alert.alert(title,body);};


const maxAppWidth=480;
const catalogueBannerRatio=750/219;

export default function App() {
 const {width:viewportWidth}=useWindowDimensions();
 const [fontsLoaded,fontError]=useFonts(fonts);
 const webViewportHeight=useWebViewportHeight();
 const [lang,setLangState]=useState<Language>(()=>readAccount().language??'ar');
 const [page,setPage]=useState<Page>('welcome');
 const [account,setAccount]=useState(readAccount);
 const accountRef=React.useRef(account);
 const updateAccount=(fields:Partial<AccountData>)=>{
   const next={...accountRef.current,...fields};
   try {
     saveAccount(next);
     accountRef.current=next;
     setAccount(next);
     return true;
   } catch {
     return false;
   }
 };
 const [clientRecords,setClientRecords]=useState(readRequests);
 const [clientFocused,setClientFocused]=useState(false);
 const [clientDraft,setClientDraft]=useState<string|null>(null);
 // Unsaved starting point for the wizard; persisted only by Save draft / Confirm (prevents duplicate drafts).
 const [clientSeed,setClientSeed]=useState<ClientRequest|null>(null);
 const setLang=(next:Language)=>{setLangState(next);updateAccount({language:next});};
 const recordsRef=React.useRef(clientRecords);
 const [signedIn,setSignedIn]=useState(false);
 const [needsEmail,setNeedsEmail]=useState(false); // an account without an email must add one before using the app
 const [legal,setLegal]=useState<'terms'|'privacy'|null>(null);
 const [langMenu,setLangMenu]=useState(false);
 const writeLocal=(records:ClientRequest[])=>{try{writeRequests(records);recordsRef.current=records;setClientRecords(records);return true}catch{return false}};
 const syncing=React.useRef(false);
 const syncAgain=React.useRef(false);
 /** Push unsynced requests, then pull. The server is authoritative for status; failures keep local data and retry later. */
 const [syncStatus,setSyncStatus]=useState<SyncStatus>('idle');
 const [loadedOnce,setLoadedOnce]=useState(false);
 const inFlight=React.useRef<Promise<void>|null>(null);
 // Pushes local changes, then pulls the server's list (the server is the reference). Concurrent calls share one run; the promise resolves when it is done.
 const syncNow=():Promise<void>=>{
   if(!apiEnabled||!hasSession())return Promise.resolve();
   if(inFlight.current){syncAgain.current=true;return inFlight.current}
   syncing.current=true;setSyncStatus('syncing');
   inFlight.current=(async()=>{
     let failed=false;
     try{
       do{
         syncAgain.current=false;
         let recs=recordsRef.current;
         for(const r of recs.filter(needsSync)){
           const next=await pushRequest(r,getBytes,id=>recs.find(x=>x.id===id)?.remoteId);
           recs=recs.map(x=>x.id===next.id?next:x);writeLocal(recs);
         }
         writeLocal(await pullRequests(recordsRef.current));
       }while(syncAgain.current);
     }catch{failed=true;/* offline or expired: local data stays, next save/login retries */}
     finally{syncing.current=false;inFlight.current=null;setSyncStatus(failed?'error':'idle');setLoadedOnce(true)}
   })();
   return inFlight.current;
 };
 const syncTimer=React.useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const saveClientRecords=(records:ClientRequest[])=>{const ok=writeLocal(records);if(ok&&apiEnabled&&hasSession()){clearTimeout(syncTimer.current);syncTimer.current=setTimeout(()=>void syncNow(),600)}return ok};
 const wipeLocal=async()=>{writeLocal([]);try{await pruneOrphanFiles([])}catch{}try{saveAccount({...emptyAccount,language:lang});accountRef.current={...emptyAccount,language:lang};setAccount(accountRef.current)}catch{}};
 const createClientRequest=(r:ClientRequest)=>saveClientRecords([...clientRecords.filter(v=>v.id!==r.id),r]);
 const resumeClient=(serviceId:string,id:string,draftId?:string,renewalOf?:string)=>{const service=SERVICES.find(s=>s.id===serviceId);if(!service)return;
   // A renewal is a new request linked to the source; the source record is never modified.
   const source=renewalOf?clientRecords.find(r=>r.id===renewalOf):undefined;const now=new Date().toISOString();
   setClientSeed(source?{id:makeId(),serviceId,actionId:id,title:source.title,createdAt:now,updatedAt:now,status:'draft',stage:1,name:source.name,phone:source.phone,fields:{},files:[],missing:[],events:[],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false},renewalOf:source.id}:null);
   setClientDraft(draftId??null);open(service,id)};
 React.useEffect(()=>{void pruneOrphanFiles(readRequests()).catch(()=>{});},[]);
 React.useEffect(()=>{
   if(!apiEnabled)return;
   setSessionExpiredHandler(()=>{setSignedIn(false);setPage('welcome')});
   void (async()=>{
     if(!await loadTokens())return;
     try{const u=await me();setSignedIn(true);if(u.user.email_set===false)setNeedsEmail(true);setPage(p=>p==='welcome'?'home':p);void syncNow()}catch{/* offline: stay on welcome; session kept */}
   })();
 },[]);
 // Keep what the team does (status, requested documents, delivery files) fresh: on opening My Requests, when the app returns to the foreground, and about every minute while My Requests is open.
 React.useEffect(()=>{
   if(!signedIn)return;
   const sub=AppState.addEventListener('change',st=>{if(st==='active')void syncNow()});
   let timer:ReturnType<typeof setInterval>|undefined;
   if(page==='requests'){void syncNow();timer=setInterval(()=>void syncNow(),60000)}
   return()=>{sub.remove();if(timer)clearInterval(timer)};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signedIn,page]);
 const [business,setBusiness]=useState(false);
 const [query,setQuery]=useState('');
 const [chosen,setChosen]=useState<Service>(SERVICES.find(x=>x.id==='labor-employment')!);
 const [tab,setTab]=useState<DetailTab>('about');
 const [actionId,setAction]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Record<string,RequestDraft>>({});
 const [choosingService,setChoosingService]=useState(false);
 const [needsAction,setNeedsAction]=useState(false);
 const detailScroll=React.useRef<React.ComponentRef<typeof ScrollView>>(null);
 const pickerPending=React.useRef(false);
 const detail=structureFor(chosen.id);
 const action=detail.actions.find(item=>item.id===actionId);
 const draftKey=action?keyFor(chosen.id,action.id):null;
 const draft=(draftKey&&drafts[draftKey])||emptyDraft;
 const documents=action?.documents??[];
 const pilotService=chosen.id==='immigration-visas';
 const [detailOrigin,setDetailOrigin]=useState<'home'|'services'>('services');
 const allowRealSubmission=false; // release gate; never send customer data in a prototype
 const ar=lang==='ar';const t=pickCopy(copy,lang);
 const allServices=useMemo(()=>{
   const search=query.trim().toLowerCase();
   return catalogueServices.filter(service=>{
     if(service.business!==business) return false;
     return !search||[serviceLabel(service,lang),serviceDescription(service,lang),
       ...structureFor(service.id).actions.map(item=>wording(item,lang))]
        .some(value=>value.toLowerCase().includes(search));
   });
 },[business,query,lang]);
 const switchLang=()=>setLangMenu(true);
 const languageMenu=<SelectSheet visible={langMenu} lang={lang} title={LANG_MENU_TITLE[lang]} selectedId={lang}
   sections={[{items:LANGS.map(code=>({id:code,title:LANG_INFO[code].native,subtitle:code===lang?undefined:LANG_NAMES[lang][code]}))}]}
   onSelect={id=>{if(isLang(id))setLang(id);setLangMenu(false)}} onClose={()=>setLangMenu(false)}/>;
 const go=(next:Page)=>{Keyboard.dismiss();setQuery('');setPage(next);};
 const open=(service:Service,nextAction:string|null=null)=>{
   setDetailOrigin(page==='home'?'home':'services');
   setNeedsAction(false);
   setChosen(service);
   setBusiness(service.business);
   setTab('about');
   setAction(nextAction);
   setChoosingService(false);
   go(nextAction?'request':'detail');
 };
 const openCatalogue=(forRequest=false)=>{
   setChoosingService(forRequest);
   go('services');
 };
 const updateDraft=(key:string,update:(current:RequestDraft)=>RequestDraft)=>{
   setDrafts(previous=>({...previous,[key]:update(previous[key]??emptyDraft)}));
 };
 const editDraft=(update:(current:RequestDraft)=>RequestDraft)=>{
   if(draftKey) updateDraft(draftKey,update);
 };
 const pick=async(documentId:string)=>{
   if(!draftKey||pickerPending.current)return;
   const key=draftKey;const requirement=documents.find(d=>d.id===documentId);if(!requirement)return;
   pickerPending.current=true;
   try{const file=await pickClientFile({ar:requirement.ar,en:requirement.en});if(file)updateDraft(key,current=>({...current,files:{...current.files,[documentId]:{name:file.name,size:file.size,uri:'',clientFile:file}}}));}
   catch{notify(tr({ar:'تعذر رفع الملف',en:'Upload failed'},lang),tr({ar:'اختر PDF أو JPG أو PNG سليمة، حتى ٥ ميغابايت.',en:'Choose a valid PDF, JPG or PNG, up to 5 MB.'},lang));}
   finally{pickerPending.current=false;}
 };
 const removeFile=(documentId:string)=>editDraft(current=>{
   const files={...current.files};
   delete files[documentId];
   return {...current,files};
 });
 const selectTab=(next:DetailTab)=>{
   setTab(next);
   detailScroll.current?.scrollTo({y:0,animated:false});
 };
 const startRequest=()=>{
   if(action){
     const now=new Date().toISOString();
     const initial:ClientRequest={id:makeId(),serviceId:chosen.id,actionId:action.id,title:{ar:action.ar,en:action.en},createdAt:now,updatedAt:now,status:'draft',stage:1,name:draft.name||account.name,phone:draft.phone||account.phone,fields:draft.fields,files:Object.values(draft.files).flatMap(f=>f.clientFile?[f.clientFile]:[]),missing:[],events:[],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false}};
     // Continue unsaved input kept from a previous visit to the same transaction.
     if(clientSeed&&clientSeed.serviceId===chosen.id&&clientSeed.actionId===action.id){const extra=initial.files.filter(f=>!clientSeed.files.some(x=>x.id===f.id));if(extra.length)setClientSeed({...clientSeed,files:[...clientSeed.files,...extra]});}
     else setClientSeed(initial);
     setClientDraft(null);go('request');return;
   }
   selectTab('about');
   setNeedsAction(true);
 };
 const title=(s:Service)=>serviceLabel(s,lang);
 const selectNav=(key:TabKey)=>key==='request'?(page==='detail'?(setClientDraft(null),startRequest()):page==='request'||page==='newrequest'?undefined:(setClientDraft(null),go('newrequest'))):key==='services'?openCatalogue():go(key);
 const tabLabels:Record<TabKey,string>={home:t.home,services:t.services,request:t.request,requests:t.requests,profile:t.profile};
 const blurTarget=React.useRef<React.ComponentRef<typeof View>>(null);
 // Every service shows its main-service banner (navy & gold, real text); the branch name is the title.
 const bannerFor=(service:Service)=>{
   const at=locate(service.id);
   if(!at) return <CategoryBanner lang={lang} id="business" title={title(service)} subtitle={serviceDescription(service,lang)}/>;
   return <CategoryBanner lang={lang} id={at.category.id} eyebrow={tr(at.category.title,lang)} title={tr(at.branch.title,lang)} subtitle={tr(at.branch.desc,lang)}
     photoId={at.branch.serviceId} count={structureFor(service.id)?.actions.length} tall/>;
 };

 const favorite=account.favorites.includes(chosen.id);
 const toggleFavorite=()=>{
   const ids=accountRef.current.favorites;
   updateAccount({favorites:ids.includes(chosen.id)?ids.filter(id=>id!==chosen.id):[...ids,chosen.id]});
 };
 const savedDrafts=Object.entries(drafts).flatMap(([key,item])=>{
   if(!item.saved) return [];
   const [serviceId,id]=key.split('/');
   const service=SERVICES.find(entry=>entry.id===serviceId);
   const savedAction=service&&structureFor(service.id).actions.find(entry=>entry.id===id);
   return service&&savedAction?[{key,service,action:savedAction}]:[];
 });
 const backRef=React.useRef<()=>boolean>(()=>false);
 backRef.current=()=>{
   if(legal){setLegal(null);return true}
   if(page==='welcome'||page==='home') return false;
   if(page==='detail'){go(detailOrigin);return true;}
   if(page==='request'){go('detail');setTab('about');return true;}
   if(page==='newrequest'){go('requests');return true;}
   go('home');return true;
 };
 React.useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>backRef.current());return ()=>sub.remove();},[]);
 if(!fontsLoaded&&!fontError) return <View style={styles.safe}/>;
 if(signedIn&&needsEmail) return <SafeAreaProvider><SafeAreaView edges={['top','bottom','left','right']} style={styles.safe}><StatusBar barStyle="dark-content"/>{languageMenu}
   <ContactScreen lang={lang} onLanguage={switchLang} logo={officialLogo} onDone={()=>setNeedsEmail(false)} onSignOut={async()=>{await logout();await wipeLocal();setSignedIn(false);setNeedsEmail(false);go('welcome')}}/>
 </SafeAreaView></SafeAreaProvider>;
 const barVisible=showsTabBar(page)&&!legal&&!(page==='requests'&&clientFocused);
 return <SafeAreaProvider><TabBarLayoutProvider><SafeAreaView edges={barVisible?['top','left','right']:['top','bottom','left','right']} style={[styles.safe,webViewportHeight!==undefined&&{height:webViewportHeight,flexGrow:0,flexShrink:0,flexBasis:'auto'}]}>
   <StatusBar barStyle="dark-content"/>
   {languageMenu}
   <BlurTargetView ref={blurTarget} key={page==='detail'?'detail:'+chosen.id:page} style={styles.screen}>
     {page==='welcome'?<AuthFlow lang={lang} onLanguage={switchLang} onGuest={()=>go('home')} onSignedIn={()=>{setSignedIn(true);go('home');void syncNow()}} onLegal={setLegal} logo={officialLogo}/>
     :page==='home'?<HomeScreen lang={lang} onLanguage={switchLang} onServices={value=>{setBusiness(value);openCatalogue();}} onSearch={value=>{openCatalogue();setQuery(value);}} onNotifications={()=>go('requests')} alerts={clientRecords.some(r=>r.status==='needs_documents'||!!r.whatNow?.actionRequired)}/>:page==='services'?<ServicesScreen lang={lang} business={business} onAudience={setBusiness} query={query} onQuery={setQuery} services={allServices}
         choosing={choosingService} onOpen={service=>open(service)} onLanguage={switchLang} onProfile={()=>go('profile')}/>
     :page==='detail'?<ServiceDetailsScreen lang={lang} service={chosen} banner={bannerFor(chosen)} onBack={()=>go(detailOrigin)} onLanguage={switchLang} scrollRef={detailScroll}
         favorite={favorite} onToggleFavorite={toggleFavorite} tab={tab} onTab={selectTab} actionId={actionId} needsAction={needsAction} showDocumentsOnAbout={pilotService}
         onSelectAction={item=>{setNeedsAction(false);setAction(item.id);if(!pilotService)selectTab('documents')}}
         files={draft.files} fields={draft.fields} onPick={id=>void pick(id)} onRemoveFile={removeFile}
         onField={(id,value)=>editDraft(current=>({...current,fields:{...current.fields,[id]:value}}))}/>
     :page==='profile'?
       <AccountScreen lang={lang} account={account} update={updateAccount} signedIn={signedIn} onEmail={setServerEmail} onLegal={setLegal} onExport={async()=>{await saveDataExport(await exportMyData());return true}} onDelete={async()=>{await deleteAccount();await wipeLocal();setSignedIn(false);go('welcome');return true}} onSignOut={async()=>{await logout();await wipeLocal();setSignedIn(false);go('welcome')}} requests={clientRecords.length+savedDrafts.length}
         documents={Object.entries(drafts).flatMap(([key,item])=>Object.entries(item.files).map(([id,file])=>({key:key+'/'+id,name:file.name})))}
         favorites={catalogueServices.filter(item=>account.favorites.includes(item.id)).map(item=>({id:item.id,label:title(item)}))}
         onFavorite={id=>{const item=catalogueServices.find(service=>service.id===id);if(item) open(item);}}
         onRequests={()=>go('requests')} onBrowse={()=>openCatalogue()} onLanguage={setLang}
         onLeave={()=>go('welcome')}
         alerts={clientRecords.filter(r=>r.status==='needs_documents'||!!r.whatNow?.actionRequired).map(r=>({id:r.id,title:tr(r.title,lang),note:tr(r.whatNow,lang)??tr(statusLabels[r.status],lang)}))}/>
       :page==='newrequest'?<NewRequestScreen lang={lang} account={{name:account.name,phone:account.phone}} signedIn={signedIn} onSaved={r=>{saveClientRecords([...clientRecords.filter(v=>v.id!==r.id),r])}} onOpenDocuments={r=>resumeClient(r.serviceId,r.actionId,r.id)} onBack={()=>go('requests')} onSignIn={()=>go('welcome')}/>
       :page==='requests'?<ClientWorkspace onRefresh={syncNow} syncStatus={syncStatus} loadedOnce={loadedOnce} lang={lang} onLanguage={switchLang} onFocusChange={setClientFocused} records={clientRecords} save={saveClientRecords} onStart={()=>{setClientDraft(null);go('newrequest');}} onResume={resumeClient} drafts={savedDrafts.map(item=>({key:item.key,title:wording(item.action,lang),resume:()=>open(item.service,item.action.id)}))}/>:page==='request'&&action?<RequestWizard onLegal={setLegal} key={chosen.id+'/'+action.id+'/'+(clientDraft??clientSeed?.id??'new')} lang={lang} serviceId={chosen.id} action={action} create={createClientRequest} onDone={()=>{setClientSeed(null);go('requests');}} onKeep={kept=>setClientSeed(kept)} onBack={()=>{go('detail');setTab('about');}} defaults={{name:account.name,phone:account.phone}} initial={clientRecords.find(r=>r.id===clientDraft)??(clientSeed&&clientSeed.serviceId===chosen.id&&clientSeed.actionId===action.id?clientSeed:undefined)}/>:<FallbackScreen lang={lang} onServices={()=>openCatalogue()}/>}
   </BlurTargetView>
   {legal&&<View style={StyleSheet.absoluteFill}><LegalScreen lang={lang} doc={legal==='terms'?TERMS:PRIVACY} onBack={()=>setLegal(null)}/></View>}
   {barVisible&&<TabBar active={activeTab(page)} labels={tabLabels} onSelect={selectNav} blurTarget={blurTarget} accessory={page==='detail'?<StartRequestBar lang={lang} onPress={startRequest}/>:undefined} rtl={lang==='ar'} labelFont={sel=>lang==='ar'?{fontFamily:sel?'CairoBold':'CairoSemiBold',fontWeight:'normal'}:{fontWeight:sel?'700':'500'}}/>}
 </SafeAreaView></TabBarLayoutProvider></SafeAreaProvider>;
}
const styles=StyleSheet.create({
 screen:{flex:1,minHeight:0,direction:'ltr',backgroundColor:C.background},
 safe:{flex:1,direction:'ltr',width:'100%',maxWidth:maxAppWidth,alignSelf:'center',backgroundColor:C.background},
 catalogueContent:{paddingBottom:24},
 homeIntro:{paddingHorizontal:16,paddingTop:14,gap:7},
 homePhotoFrame:{aspectRatio:1600/500,borderRadius:16,overflow:'hidden',backgroundColor:'#DDE2EA'},
 homePhoto:{width:'100%',height:'100%'},
 header:{alignItems:'center',paddingHorizontal:16,paddingTop:12,gap:9},
 logo:{width:53,height:53,borderRadius:27,borderWidth:2,borderColor:C.gold},
 brand:{fontSize:17,fontWeight:'900'},brandSub:{fontSize:8,color:C.muted,fontWeight:'700'},
 headRound:{width:42,height:42,borderRadius:15,padding:0},
 heroTitle:{fontSize:24,fontWeight:'900',lineHeight:34},heroIntro:{fontSize:13,color:C.muted,lineHeight:21},
 body:{paddingHorizontal:16,paddingTop:13},
 softButton:{backgroundColor:'#FFFFFF',minHeight:45,paddingHorizontal:12,paddingVertical:9,borderRadius:18,borderColor:'#FFF',borderWidth:1,alignItems:'center',justifyContent:'center',shadowColor:C.brown,shadowOpacity:.1,shadowRadius:10,elevation:2},
 selected:{backgroundColor:C.orange,borderColor:'#D9BC7E'},
 segment:{padding:4,borderRadius:24,backgroundColor:'#EEF1F6',marginBottom:15,gap:6},
 segmentText:{color:C.brown,fontSize:14,fontWeight:'800',textAlign:'center'},
 search:{height:53,backgroundColor:'#FFFFFF',borderRadius:23,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,paddingHorizontal:12,marginBottom:18,elevation:3},
 input:{flex:1,color:C.ink,fontSize:13},
 sectionHead:{alignItems:'center',gap:9,marginBottom:12,marginTop:8},
 sectionMark:{width:4,height:24,borderRadius:4,backgroundColor:C.orange},sectionTitle:{fontSize:19,fontWeight:'900'},
 serviceCard:{borderRadius:19,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#FFF',overflow:'hidden',marginBottom:11,elevation:3,shadowColor:C.brown,shadowOpacity:.11,shadowRadius:9},
 bannerFrame:{width:'100%',overflow:'hidden',backgroundColor:'#E9ECF2'},
 catalogueBanner:{width:'100%',aspectRatio:catalogueBannerRatio,minHeight:0,backgroundColor:'#EEF1F6'},
 bannerTitle:{fontSize:14,fontWeight:'900',lineHeight:19,alignSelf:'stretch'},
 illustratedBanner:{width:'100%',minHeight:95,justifyContent:'center',overflow:'hidden'},
 bannerCaption:{width:'56%',padding:11,backgroundColor:C.white,gap:5},
 navActive:{borderBottomWidth:2,borderColor:C.orange},
 catalogueHeader:{paddingBottom:12,backgroundColor:'#EEF1F6',borderBottomWidth:1,borderColor:C.line},
 inlineIcon:{alignItems:'center',gap:5},
 detailTop:{alignItems:'center',paddingHorizontal:15,paddingVertical:14,gap:10},
 back:{width:44,minHeight:44,padding:0},
 detailHeading:{fontSize:21,fontWeight:'900'},
 detailSubtitle:{fontSize:12,lineHeight:18,color:C.muted,marginTop:3},
 detailHero:{overflow:'hidden',borderRadius:16,marginHorizontal:14,backgroundColor:'#E6EAF1'},
 favoriteRow:{paddingHorizontal:14,marginTop:4},
 favoriteAction:{minHeight:44,borderRadius:12,paddingHorizontal:9,alignItems:'center',gap:6},
 tabRow:{gap:7,marginBottom:14},
 tabButton:{flex:1,minHeight:53,paddingHorizontal:4,gap:3},
 tabText:{fontSize:12,textAlign:'center',fontWeight:'800',color:C.brown},
 panel:{backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:18,padding:14,marginBottom:12},
 paragraph:{fontSize:14,color:C.brown,lineHeight:23},
 actionGroupTitle:{width:'100%',fontSize:14,fontWeight:'800',color:C.brown,marginTop:7,marginBottom:2},
 actionGrid:{flexWrap:'wrap',gap:8},
 actionCard:{minHeight:60,flexBasis:'48%',flexGrow:1,padding:9,borderRadius:13,
   backgroundColor:'#F5F7FA',borderColor:C.line,borderWidth:1,alignItems:'center',gap:7},
 selectionHint:{fontSize:13,color:'#76592A',marginBottom:10},
 actionSelected:{backgroundColor:'#E8EDFB',borderColor:'#8A6A2F'},
 actionText:{fontWeight:'700',fontSize:13,lineHeight:18,flex:1},
 noteLine:{alignItems:'flex-start',gap:7,paddingVertical:3},noteBullet:{color:C.orange,fontSize:10,marginTop:5},
 docRow:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.line,alignItems:'center',gap:5},
 docTitle:{fontSize:13,fontWeight:'800'},fileName:{fontSize:11,color:C.muted,marginTop:4},
 upload:{minHeight:44,paddingHorizontal:8,borderColor:C.line,borderWidth:1},
 remove:{minHeight:44,minWidth:44,paddingHorizontal:6,borderColor:C.line,borderWidth:1},
 uploadText:{fontWeight:'800',fontSize:12,color:C.brown},
 contextText:{fontSize:13,lineHeight:19,fontWeight:'700',color:'#76592A',marginTop:6,marginBottom:6},
 warning:{fontSize:12,color:C.muted,marginTop:10,lineHeight:19},
 detailFooter:{paddingHorizontal:14,paddingVertical:8},
 changeAction:{alignSelf:'stretch',minHeight:44,marginTop:7},
 draftButton:{marginTop:12,minHeight:48},
 bigCTA:{minHeight:52,backgroundColor:C.orange},
 ctaRow:{alignItems:'center',justifyContent:'center',gap:10},
 ctaText:{color:C.ink,fontWeight:'900',fontSize:16},
 formInput:{height:48,backgroundColor:'white',borderRadius:13,borderWidth:1,borderColor:C.line,marginVertical:8,paddingHorizontal:12},
});



