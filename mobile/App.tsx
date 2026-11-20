import React, {useMemo, useState} from 'react';
import {Alert, AppState, BackHandler, Image, ImageBackground, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {IBMPlexSansArabic_500Medium} from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import {IBMPlexSansArabic_700Bold} from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import {PlusJakartaSans_500Medium} from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import {PlusJakartaSans_700Bold} from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import * as DocumentPicker from 'expo-document-picker';
import {SERVICES, catalogueServices, Service, serviceLabel, serviceDescription} from './src/services';
import {structureFor, tradeLicenceSectionTitles, wording} from './src/serviceDetails';
import {Icon, serviceIcon, transactionIcon} from './src/Icons';
import {bannerFrameFor, individualCatalogueBannerFor} from './src/approvedBanners';
import {CompanyBanner, companyBannerFonts} from './src/CompanyBanner';
import {ClientWorkspace,RequestWizard} from './src/ClientWorkspace';
import {pickClientFile,pruneOrphanFiles,readRequests,writeRequests,getBytes,saveDataExport} from './src/clientStorage';
import {makeId,type ClientRequest,type ClientFile} from './src/clientModel';
import {HomeScreen} from './src/HomeScreen';
import {WelcomeScreen} from './src/WelcomeScreen';
import {AccountScreen} from './src/AccountScreen';
import {readAccount,saveAccount,emptyAccount,type AccountData} from './src/accountStorage';
import {LegalScreen} from './src/LegalScreen';
import {TERMS,PRIVACY} from './src/legal';
import {apiEnabled,hasSession,loadTokens,logout,me,pullRequests,pushRequest,needsSync,exportMyData,deleteAccount,setSessionExpiredHandler} from './src/api';

type Language='ar'|'en';
type Page='welcome'|'home'|'services'|'detail'|'requests'|'profile'|'request';
type DetailTab='about'|'documents'|'fees';
type LocalFile={name:string;size?:number;uri:string;clientFile?:ClientFile};
type RequestDraft={
  name:string;
  phone:string;
  files:Record<string,LocalFile>;
  fields:Record<string,string>;
  saved?:boolean;
};
const fonts={
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
const documentTypes:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
const maxFileBytes=5*1024*1024;
const C={background:'#F8F3ED',white:'#FFF9F4',ink:'#30251F',muted:'#76665B',line:'#E9DACC',orange:'#FF8A00',gold:'#FFB341',brown:'#3C281B'};
const hero=require('./assets/brand/dubai_hero.webp');
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
    languages:'العربية',choose:'Choose service',name:'Full name',phone:'Phone number',next:'Continue',saved:'Save Demo Draft'}
} as const;
function AppText({children,lang,style,numberOfLines}: {children:React.ReactNode,lang:Language,style?:any,numberOfLines?:number}) {
 const weight=StyleSheet.flatten(style)?.fontWeight;
 return <Text numberOfLines={numberOfLines} style={[{textAlign:lang==='ar'?'right':'left',writingDirection:lang==='ar'?'rtl':'ltr',color:C.ink},style,font(lang,!!weight)]}>{children}</Text>;
}
function SoftButton({onPress,children,selected=false,style,label,tab=false}: {
 onPress:()=>void; children:React.ReactNode; selected?:boolean; style?:any; label?:string; tab?:boolean;
}) {
 return <Pressable accessibilityRole={tab?'tab':'button'} accessibilityLabel={label}
   accessibilityState={tab?{selected}:undefined} onPress={onPress}
   style={({pressed})=>[styles.softButton,selected&&styles.selected,style,pressed&&{opacity:.8}]}>{children}</Pressable>;
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
const notify=(title:string,body?:string)=>{if(Platform.OS==='web'&&typeof window!=='undefined')window.alert(body?title+'\n'+body:title);else Alert.alert(title,body);};


const maxAppWidth=480;
const catalogueBannerRatio=750/219;

export default function App() {
 const {width:viewportWidth}=useWindowDimensions();
 const bannerWidth=Math.min(viewportWidth,maxAppWidth)-34;
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
 const [legal,setLegal]=useState<'terms'|'privacy'|null>(null);
 const writeLocal=(records:ClientRequest[])=>{try{writeRequests(records);recordsRef.current=records;setClientRecords(records);return true}catch{return false}};
 const syncing=React.useRef(false);
 const syncAgain=React.useRef(false);
 /** Push unsynced requests, then pull. The server is authoritative for status; failures keep local data and retry later. */
 const syncNow=async()=>{
   if(!apiEnabled||!hasSession())return;
   if(syncing.current){syncAgain.current=true;return}
   syncing.current=true;
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
   }catch{/* offline or expired: local data stays, next save/login retries */}
   finally{syncing.current=false}
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
     try{await me();setSignedIn(true);setPage(p=>p==='welcome'?'home':p);void syncNow()}catch{/* offline: stay on welcome; session kept */}
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
 const ar=lang==='ar';const t=copy[lang];const row: 'row'|'row-reverse'=ar?'row-reverse':'row';
 const allServices=useMemo(()=>{
   const search=query.trim().toLowerCase();
   return catalogueServices.filter(service=>{
     if(service.business!==business) return false;
     return !search||[serviceLabel(service,lang),serviceDescription(service,lang),
       ...structureFor(service.id).actions.map(item=>wording(item,lang))]
        .some(value=>value.toLowerCase().includes(search));
   });
 },[business,query,lang]);
 const switchLang=()=>setLang(lang==='ar'?'en':'ar');
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
   catch{notify(ar?'تعذر رفع الملف':'Upload failed',ar?'اختر PDF أو JPG أو PNG سليمة، حتى ٥ ميغابايت.':'Choose a valid PDF, JPG or PNG, up to 5 MB.');}
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
 const subtitle=(s:Service)=>serviceDescription(s,lang);
 const arrow=ar?'‹':'›';
 const label=(key:keyof typeof copy.ar)=>t[key];
 const header=()=> <View style={[styles.header,{flexDirection:row}]}>
   <Image source={officialLogo} style={styles.logo}/>
   <View style={{flex:1}}><AppText lang={lang} style={styles.brand}>{label('brand')}</AppText><AppText lang={lang} style={styles.brandSub}>{ar?'خدمات تخليص المعاملات':'DOCUMENT CLEARANCE SERVICES'}</AppText></View>
   <SoftButton onPress={switchLang} style={styles.headRound}><Text style={{fontWeight:'800',color:C.orange}}>{ar?'EN':'ع'}</Text></SoftButton>
   <SoftButton onPress={()=>go('profile')} label={t.profile} style={styles.headRound}><Icon name="user" color={C.ink}/></SoftButton>
 </View>;
 const nav=()=> <View style={[styles.nav,{flexDirection:row}]}>
   {([['home','home'],['services','grid'],['request','plus'],['requests','folder'],['profile','user']] as const).map(([key,icon])=>{
     const active=page===key||(page==='detail'&&key==='services');
     return <Pressable key={key} accessibilityRole="button" accessibilityLabel={t[key]}
       accessibilityState={{selected:active}} onPress={()=>key==='request'?(page==='detail'?(setClientDraft(null),startRequest()):page==='request'?undefined:(setClientDraft(null),openCatalogue(true))):
         key==='services'?openCatalogue():go(key)} style={[styles.navItem,active&&key!=='request'&&{backgroundColor:'#F5E9CE',borderRadius:16,marginVertical:7}]}>
       <View style={[key==='request'?styles.plus:styles.navIconBox,active&&key!=='request'&&{borderBottomWidth:0}]}>
         <Icon name={icon} filled={active&&icon==='home'} size={key==='request'?32:26} color={key==='request'?'white':active?'#98500C':C.ink}/>
       </View>
       <Text numberOfLines={1} style={[styles.navText,active&&styles.navTextActive,font(lang,active),lang==='ar'&&{fontFamily:'ReferenceArabic'}]}>{t[key]}</Text>
     </Pressable>;
   })}
 </View>;
 const sectionHeader=(s:string)=><View style={[styles.sectionHead,{flexDirection:row}]}>
   <View style={styles.sectionMark}/><AppText lang={lang} style={styles.sectionTitle}>{s}</AppText>
 </View>;
 const audience=()=> <View style={[styles.segment,{flexDirection:row}]}>
   {([[false,t.individual],[true,t.company]] as const).map(([isBusiness,text])=>
     <SoftButton key={text} tab selected={business===isBusiness} onPress={()=>setBusiness(isBusiness)} style={{flex:1,minHeight:49}}>
       <Text style={[styles.segmentText,font(lang,true)]}>{text}</Text>
     </SoftButton>
   )}
 </View>;
 const nextIcon=ar?'back':'next';
 const bannerFor=(service:Service,inCatalogue=false)=>{
   if(service.business && service.id!=='complete-business') return <CompanyBanner id={service.id} language={lang} width={bannerWidth}/>;
   const reference=inCatalogue?individualCatalogueBannerFor(service.id,lang):undefined;
   const artwork=reference??bannerFrameFor(service.id,lang);
   if(!artwork) return <ImageBackground source={hero} resizeMode="cover" style={[styles.illustratedBanner,inCatalogue&&styles.catalogueBanner]}>
     <View style={[styles.bannerCaption,{alignSelf:ar?'flex-end':'flex-start'}]}>
       <Icon name={serviceIcon(service.id)} size={20}/>
       <AppText lang={lang} style={styles.bannerTitle}>{title(service)}</AppText>
     </View>
   </ImageBackground>;

   const [x,y,w,h]=artwork.bounds;
   return <View style={[styles.bannerFrame,inCatalogue?styles.catalogueBanner:{aspectRatio:w/h}]}>
     <Image source={artwork.source} resizeMode="stretch" accessible={false}
       style={{position:'absolute',width:`${(reference?.width??960)/w*100}%`,height:`${(reference?.height??226)/h*100}%`,left:`-${x/w*100}%`,top:`-${y/h*100}%`}}/>

   </View>;
 };
 const serviceTile=(service:Service)=> <Pressable key={service.id}
   accessibilityRole="button" accessibilityLabel={title(service)} onPress={()=>open(service)}
   style={({pressed})=>[styles.serviceCard,pressed&&{opacity:.82}]}>
   {bannerFor(service,true)}
 </Pressable>;
 const searchBar=()=> <View style={[styles.search,{flexDirection:row}]}>
   <Icon name="search" size={20}/>
   <TextInput value={query} onChangeText={setQuery} accessibilityLabel={t.search}
     placeholder={t.search} placeholderTextColor={C.muted}
     style={[styles.input,font(lang,false),{textAlign:ar?'right':'left'}]}/>
 </View>;
 const cataloguePage=(isHome:boolean)=> <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.catalogueContent}>
   <View style={styles.catalogueHeader}>{header()}</View>
   {isHome&&<View style={styles.homeIntro}>
     <View style={styles.homePhotoFrame}>
       <Image source={hero} resizeMode="cover" style={styles.homePhoto}
         accessibilityLabel={ar?'متحف المستقبل وأفق دبي':'Museum of the Future and Dubai skyline'}/>
     </View>
     <AppText lang={lang} style={styles.heroTitle}>{t.welcome} {t.brand}</AppText>
     <AppText lang={lang} style={styles.heroIntro}>{t.intro}</AppText>
   </View>}
   <View style={styles.body}>
     {audience()}
     {searchBar()}
     {sectionHeader(!isHome&&choosingService?t.choose:business?t.title:t.individualTitle)}
     {allServices.map(serviceTile)}
     {allServices.length===0&&<AppText lang={lang} style={styles.paragraph}>
       {ar?'لم نجد خدمة مطابقة.':'No matching services.'}
     </AppText>}
   </View>
 </ScrollView>;
 const chooseActionHint=ar?'اختر المعاملة أولاً لعرض مستنداتها.':'Choose a transaction to see its documents.';
 const docPanel=()=> <View style={styles.panel}>
   {sectionHeader(t.docs)}
   {action&&<AppText lang={lang} style={styles.contextText}>{wording(action,lang)}</AppText>}
   {!action
     ? <AppText lang={lang} style={styles.paragraph}>{chooseActionHint}</AppText>
     : documents.length===0
       ? <AppText lang={lang} style={styles.paragraph}>{ar?'يمكنك بدء الطلب دون إرفاق مستند في هذه الخطوة.':'You can start this request without attaching a document at this step.'}</AppText>
       : documents.map(d=>{
           const file=draft.files[d.id];
           return <View key={d.id} style={[styles.docRow,{flexDirection:row}]}>
             <View style={{flex:1}}>
               <AppText lang={lang} style={styles.docTitle}>{wording(d,lang)}</AppText>
               {file&&<AppText lang={lang} style={styles.fileName} numberOfLines={1}>{file.name}</AppText>}
               {d.field==='text'&&<TextInput
                 accessibilityLabel={wording(d,lang)}
                 placeholder={wording(d,lang)}
                 value={draft.fields[d.id]??''}
                 onChangeText={value=>editDraft(current=>({...current,fields:{...current.fields,[d.id]:value}}))}
                 style={[styles.formInput,font(lang,false),{textAlign:ar?'right':'left'}]}/>}
             </View>
             {!d.field&&<>
               <SoftButton onPress={()=>pick(d.id)} label={(file?(ar?'استبدال ':'Replace '):t.upload+' ')+wording(d,lang)} style={styles.upload}>
                 <View style={[styles.inlineIcon,{flexDirection:row}]}><Icon name="upload" size={15}/><Text style={[styles.uploadText,font(lang,true)]}>{file?(ar?'استبدال':'Replace'):t.upload}</Text></View>
               </SoftButton>
               {file&&<SoftButton onPress={()=>removeFile(d.id)} label={(ar?'إزالة ':'Remove ')+wording(d,lang)} style={styles.remove}>
                 <Icon name="close" size={17}/>
               </SoftButton>}
             </>}
           </View>;
         })}
   {action&&documents.some(d=>!d.field)&&
     <AppText lang={lang} style={styles.warning}>{ar?'PDF أو JPG أو PNG، بحد أقصى ٥ ميغابايت لكل ملف.':'PDF, JPG or PNG, up to 5 MB per file.'}</AppText>}
 </View>;

 const favorite=account.favorites.includes(chosen.id);
 const favoriteLabel=favorite?(ar?'إزالة من المفضلة':'Remove from Favorites'):(ar?'إضافة إلى المفضلة':'Add to Favorites');
 const toggleFavorite=()=>{
   const ids=accountRef.current.favorites;
   updateAccount({favorites:ids.includes(chosen.id)?ids.filter(id=>id!==chosen.id):[...ids,chosen.id]});
 };
 const detailPage=()=> <ScrollView ref={detailScroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{paddingBottom:16}}>
   <View style={[styles.detailTop,{flexDirection:row}]}>
     <SoftButton onPress={()=>go(detailOrigin)} label={ar?'رجوع':'Back'} style={styles.back}><Icon name={ar?'next':'back'} color={C.ink}/></SoftButton>
     <View style={{flex:1}}>
       <AppText lang={lang} style={styles.detailHeading}>{title(chosen)}</AppText>
       <AppText lang={lang} style={styles.detailSubtitle}>{subtitle(chosen)}</AppText>
     </View>
     <SoftButton onPress={switchLang} style={styles.headRound}><Text style={{fontWeight:'800',color:C.orange}}>{ar?'EN':'ع'}</Text></SoftButton>
   </View>
   <View style={styles.detailHero}>{bannerFor(chosen)}</View>
   <View style={[styles.favoriteRow,{alignItems:ar?'flex-end':'flex-start'}]}>
     <Pressable accessibilityRole="button" accessibilityState={{selected:favorite}} onPress={toggleFavorite}
       style={[styles.favoriteAction,{flexDirection:row},favorite&&{backgroundColor:'#F8E7CE'}]}>
       <Icon name="star" size={17}/>
       <AppText lang={lang} style={styles.uploadText}>{favoriteLabel}</AppText>
     </Pressable>
   </View>
   <View style={styles.body}>
     <View accessibilityRole="tablist" style={[styles.tabRow,{flexDirection:row}]}>
       {([['about',t.details,'info'],['documents',t.docs,'file'],['fees',t.fees,'clock']] as const).map(([key,text,icon])=>
         <SoftButton key={key} tab onPress={()=>selectTab(key)} selected={tab===key} style={styles.tabButton}>
           <Icon name={icon} size={16}/><Text style={[styles.tabText,font(lang,true)]}>{text}</Text>
         </SoftButton>)}
     </View>
     {tab==='about'&& <>
       <View style={styles.panel}>
         {sectionHeader(t.about)}
         <AppText lang={lang} style={styles.paragraph}>{wording(detail.about,lang)}</AppText>
       </View>
       <View style={styles.panel}>
         {sectionHeader(t.transactions)}
         {needsAction&&<AppText lang={lang} style={styles.selectionHint}>{ar?'اختر المعاملة المطلوبة للمتابعة.':'Choose a transaction to continue.'}</AppText>}
         <View style={[styles.actionGrid,{flexDirection:row}]}>
           {detail.actions.map(item=>{
             const selected=actionId===item.id;
             const groupTitle=chosen.id==='trade-licenses'?tradeLicenceSectionTitles[item.id]:undefined;
             return <React.Fragment key={item.id}>
              {groupTitle&&<AppText lang={lang} style={styles.actionGroupTitle}>{wording(groupTitle,lang)}</AppText>}
              <Pressable
               accessibilityRole="button"
               accessibilityState={{selected}}
               onPress={()=>{
                 setNeedsAction(false);
                 setAction(item.id);
                 if(!pilotService) selectTab('documents');
               }}
               style={({pressed})=>[styles.actionCard,{flexDirection:row},selected&&styles.actionSelected,pressed&&{opacity:.78}]}>
                 <Icon name={transactionIcon(item.icon)} size={18}/>
                 <AppText lang={lang} style={styles.actionText}>{wording(item,lang)}</AppText>
                 <Icon name={selected?'check':nextIcon} size={15}/>
             </Pressable>
             </React.Fragment>;
           })}
         </View>
       </View>
       {pilotService&&docPanel()}
       {!pilotService&&<View style={styles.panel}>
         {sectionHeader(ar?'ملاحظات مهمة':'Important Notes')}
         {detail.notes.map((note,i)=><View key={i} style={[styles.noteLine,{flexDirection:row}]}>
             <Text style={styles.noteBullet}>●</Text>
             <View style={{flex:1}}><AppText lang={lang} style={styles.paragraph}>{wording(note,lang)}</AppText></View>
           </View>)}
         {detail.contentStatus==='review-required'&&
           <AppText lang={lang} style={styles.warning}>{ar?'تُؤكد المستندات والإجراءات بحسب المعاملة قبل التقديم.':'Documents and procedures will be confirmed for the selected transaction before submission.'}</AppText>}
       </View>}
     </>}
     {tab==='documents'&&<>
       {docPanel()}
       <SoftButton onPress={()=>selectTab('about')} style={styles.changeAction}>
         <AppText lang={lang} style={styles.uploadText}>{action?(ar?'تغيير المعاملة':'Change Transaction'):(ar?'اختيار المعاملة':'Choose Transaction')}</AppText>
       </SoftButton>
     </>}
     {tab==='fees'&&<View style={styles.panel}>
       {sectionHeader(t.fees)}
       <AppText lang={lang} style={styles.paragraph}>{t.notice}</AppText>
       {action&&<AppText lang={lang} style={styles.contextText}>{wording(action,lang)}</AppText>}
       <AppText lang={lang} style={styles.warning}>{ar?'الرسوم والمدة قيد التحقق لدى الجهة المختصة.':'Fees and timelines are pending confirmation from the relevant authority.'}</AppText>
     </View>}
   </View>
 </ScrollView>;
 const detailCTA=()=> <View style={styles.detailFooter}>
   <SoftButton onPress={startRequest} selected style={styles.bigCTA}>
     <View style={[styles.ctaRow,{flexDirection:row}]}>
       <AppText lang={lang} style={styles.ctaText}>{t.start}</AppText>
       <Icon name={nextIcon} size={19} color={C.ink}/>
     </View>
   </SoftButton>
 </View>;
 const saveDraft=()=>{
   if(!draftKey||!action) return;
   if(!draft.name.trim()||draft.phone.replace(/[^0-9٠-٩۰-۹]/g,'').length<7){
     notify(ar?'البيانات ناقصة':'Missing Details',
       ar?'أدخل الاسم ورقم هاتف صحيح.':'Enter a name and a valid phone number.');
     return;
   }
   const incomplete=documents.find(item=>item.field==='text'&&!item.optional&&!draft.fields[item.id]?.trim());
   if(incomplete){
     notify(ar?'البيانات ناقصة':'Missing Details',wording(incomplete,lang));
     go('detail');
     setTab('documents');
     return;
   }
   updateDraft(draftKey,current=>({...current,saved:true}));
 };
 const savedDrafts=Object.entries(drafts).flatMap(([key,item])=>{
   if(!item.saved) return [];
   const [serviceId,id]=key.split('/');
   const service=SERVICES.find(entry=>entry.id===serviceId);
   const savedAction=service&&structureFor(service.id).actions.find(entry=>entry.id===id);
   return service&&savedAction?[{key,service,action:savedAction}]:[];
 });
 const simplePage=()=> <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{padding:20,paddingBottom:35}}>
   {header()}{sectionHeader(page==='requests'?t.requests:t.request)}
   {page==='request'&&action?<>
     <View style={styles.panel}>
       <AppText lang={lang} style={styles.docTitle}>{title(chosen)}</AppText>
       <AppText lang={lang} style={styles.contextText}>{wording(action,lang)}</AppText>
       <SoftButton onPress={()=>{setTab('about');go('detail');}} style={styles.changeAction}>
         <AppText lang={lang} style={styles.uploadText}>{ar?'تغيير المعاملة':'Change Transaction'}</AppText>
       </SoftButton>
     </View>
     <View style={styles.panel}>
       {sectionHeader(ar?'بيانات مقدم الطلب':'Applicant Details')}
       <AppText lang={lang} style={styles.docTitle}>{t.name}</AppText>
       <TextInput accessibilityLabel={t.name} value={draft.name} autoComplete="name"
         onChangeText={name=>editDraft(current=>({...current,name}))}
         style={[styles.formInput,font(lang,false),{textAlign:ar?'right':'left'}]}/>
       <AppText lang={lang} style={styles.docTitle}>{t.phone}</AppText>
       <TextInput accessibilityLabel={t.phone} value={draft.phone} keyboardType="phone-pad" autoComplete="tel"
         onChangeText={phone=>editDraft(current=>({...current,phone}))}
         style={[styles.formInput,font(lang,false),{textAlign:ar?'right':'left'}]}/>
       {documents.length>0&&<>
         <AppText lang={lang} style={styles.warning}>
           {ar?'الملفات المرفقة بالمسودة: ':'Files attached to this draft: '}{Object.keys(draft.files).length}
         </AppText>
         <SoftButton onPress={()=>{setTab('documents');go('detail');}} style={styles.changeAction}>
           <AppText lang={lang} style={styles.uploadText}>{ar?'مراجعة المستندات':'Review Documents'} {arrow}</AppText>
         </SoftButton>
       </>}
       <SoftButton selected onPress={saveDraft} style={styles.draftButton}>
         <Text style={[styles.ctaText,font(lang,true)]}>{t.saved}</Text>
       </SoftButton>
       {draft.saved&&<AppText lang={lang} style={styles.contextText}>
         {ar?'حُفظت المسودة في طلباتي لهذه الجلسة.':'Draft saved under Requests for this session.'}
       </AppText>}
     </View>
     {!allowRealSubmission&&<AppText lang={lang} style={styles.warning}>{t.notLive}</AppText>}
   </>:page==='requests'&&savedDrafts.length>0?savedDrafts.map(item=>
     <Pressable key={item.key} accessibilityRole="button" style={styles.panel}
       onPress={()=>open(item.service,item.action.id)}>
       <AppText lang={lang} style={styles.docTitle}>{title(item.service)}</AppText>
       <AppText lang={lang} style={styles.contextText}>{wording(item.action,lang)}</AppText>
     </Pressable>
   ):<View style={styles.panel}><AppText lang={lang} style={styles.paragraph}>{page==='requests'?t.noRequests:t.notLive}</AppText></View>}
 </ScrollView>;
 const backRef=React.useRef<()=>boolean>(()=>false);
 backRef.current=()=>{
   if(legal){setLegal(null);return true}
   if(page==='welcome'||page==='home') return false;
   if(page==='detail'){go(detailOrigin);return true;}
   if(page==='request'){go('detail');setTab('about');return true;}
   go('home');return true;
 };
 React.useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>backRef.current());return ()=>sub.remove();},[]);
 if(!fontsLoaded&&!fontError) return <View style={styles.safe}/>;
 return <SafeAreaProvider><SafeAreaView edges={['top','bottom','left','right']} style={[styles.safe,webViewportHeight!==undefined&&{height:webViewportHeight,flexGrow:0,flexShrink:0,flexBasis:'auto'}]}>
   <StatusBar barStyle="dark-content"/>
   <View key={page==='detail'?'detail:'+chosen.id:page} style={styles.screen}>
     {page==='welcome'?<WelcomeScreen lang={lang} onLanguage={setLang} onGuest={()=>go('home')} onSignedIn={()=>{setSignedIn(true);go('home');void syncNow()}} onLegal={setLegal}
       logo={officialLogo} Text={AppText} inputFont={font(lang,false).fontFamily}/>
     :page==='home'?<HomeScreen lang={lang} onLanguage={switchLang} onServices={value=>{setBusiness(value);openCatalogue();}} onSearch={value=>{openCatalogue();setQuery(value);}} onNotifications={()=>go('requests')} alerts={clientRecords.some(r=>r.status==='needs_documents')}/>:page==='services'?cataloguePage(false):page==='detail'?detailPage():page==='profile'?
       <AccountScreen lang={lang} account={account} update={updateAccount} signedIn={signedIn} onLegal={setLegal} onExport={async()=>{await saveDataExport(await exportMyData());return true}} onDelete={async()=>{await deleteAccount();await wipeLocal();setSignedIn(false);go('welcome');return true}} onSignOut={async()=>{await logout();await wipeLocal();setSignedIn(false);go('welcome')}} requests={clientRecords.length+savedDrafts.length}
         documents={Object.entries(drafts).flatMap(([key,item])=>Object.entries(item.files).map(([id,file])=>({key:key+'/'+id,name:file.name})))}
         favorites={catalogueServices.filter(item=>account.favorites.includes(item.id)).map(item=>({id:item.id,label:title(item)}))}
         onFavorite={id=>{const item=catalogueServices.find(service=>service.id===id);if(item) open(item);}}
         onRequests={()=>go('requests')} onBrowse={()=>openCatalogue()} onLanguage={setLang}
         onLeave={()=>go('welcome')} logo={officialLogo} Text={AppText} inputFont={font(lang,false).fontFamily}/>
       :page==='requests'?<ClientWorkspace onRefresh={()=>void syncNow()} lang={lang} onLanguage={switchLang} onFocusChange={setClientFocused} records={clientRecords} save={saveClientRecords} onStart={()=>{setClientDraft(null);openCatalogue(true);}} onResume={resumeClient} drafts={savedDrafts.map(item=>({key:item.key,title:wording(item.action,lang),resume:()=>open(item.service,item.action.id)}))}/>:page==='request'&&action?<RequestWizard onLegal={setLegal} key={chosen.id+'/'+action.id+'/'+(clientDraft??clientSeed?.id??'new')} lang={lang} serviceId={chosen.id} action={action} create={createClientRequest} onDone={()=>{setClientSeed(null);go('requests');}} onKeep={kept=>setClientSeed(kept)} onBack={()=>{go('detail');setTab('about');}} defaults={{name:account.name,phone:account.phone}} initial={clientRecords.find(r=>r.id===clientDraft)??(clientSeed&&clientSeed.serviceId===chosen.id&&clientSeed.actionId===action.id?clientSeed:undefined)}/>:simplePage()}
   </View>
   {legal&&<View style={StyleSheet.absoluteFill}><LegalScreen lang={lang} doc={legal==='terms'?TERMS:PRIVACY} onBack={()=>setLegal(null)} Text={AppText}/></View>}
   {page!=='welcome'&&!legal&&!(page==='requests'&&clientFocused)&&<View style={styles.bottomDock}>
     {page==='detail'&&detailCTA()}
     {nav()}
   </View>}
 </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({
 screen:{flex:1,minHeight:0,direction:'ltr'},
 bottomDock:{flexShrink:0,backgroundColor:C.white},
 safe:{flex:1,direction:'ltr',width:'100%',maxWidth:maxAppWidth,alignSelf:'center',backgroundColor:C.background},
 catalogueContent:{paddingBottom:24},
 homeIntro:{paddingHorizontal:16,paddingTop:14,gap:7},
 homePhotoFrame:{aspectRatio:1600/500,borderRadius:16,overflow:'hidden',backgroundColor:'#E5C6A9'},
 homePhoto:{width:'100%',height:'100%'},
 header:{alignItems:'center',paddingHorizontal:16,paddingTop:12,gap:9},
 logo:{width:53,height:53,borderRadius:27,borderWidth:2,borderColor:C.gold},
 brand:{fontSize:17,fontWeight:'900'},brandSub:{fontSize:8,color:C.muted,fontWeight:'700'},
 headRound:{width:42,height:42,borderRadius:15,padding:0},
 heroTitle:{fontSize:24,fontWeight:'900',lineHeight:34},heroIntro:{fontSize:13,color:C.muted,lineHeight:21},
 body:{paddingHorizontal:16,paddingTop:13},
 softButton:{backgroundColor:'#FFF9F2',minHeight:45,paddingHorizontal:12,paddingVertical:9,borderRadius:18,borderColor:'#FFF',borderWidth:1,alignItems:'center',justifyContent:'center',shadowColor:C.brown,shadowOpacity:.1,shadowRadius:10,elevation:2},
 selected:{backgroundColor:C.orange,borderColor:'#FFC16F'},
 segment:{padding:4,borderRadius:24,backgroundColor:'#FFF6EC',marginBottom:15,gap:6},
 segmentText:{color:C.brown,fontSize:14,fontWeight:'800',textAlign:'center'},
 search:{height:53,backgroundColor:'#FFFAF5',borderRadius:23,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,paddingHorizontal:12,marginBottom:18,elevation:3},
 input:{flex:1,color:C.ink,fontSize:13},
 sectionHead:{alignItems:'center',gap:9,marginBottom:12,marginTop:8},
 sectionMark:{width:4,height:24,borderRadius:4,backgroundColor:C.orange},sectionTitle:{fontSize:19,fontWeight:'900'},
 serviceCard:{borderRadius:19,backgroundColor:'#FFF9F2',borderWidth:1,borderColor:'#FFF',overflow:'hidden',marginBottom:11,elevation:3,shadowColor:C.brown,shadowOpacity:.11,shadowRadius:9},
 bannerFrame:{width:'100%',overflow:'hidden',backgroundColor:'#F5E7D8'},
 catalogueBanner:{width:'100%',aspectRatio:catalogueBannerRatio,minHeight:0,backgroundColor:'#FCF2E5'},
 bannerTitle:{fontSize:14,fontWeight:'900',lineHeight:19,alignSelf:'stretch'},
 illustratedBanner:{width:'100%',minHeight:95,justifyContent:'center',overflow:'hidden'},
 bannerCaption:{width:'56%',padding:11,backgroundColor:C.white,gap:5},
 nav:{height:72,backgroundColor:C.white,borderTopWidth:1,borderColor:C.line,justifyContent:'space-around',paddingHorizontal:5},
 navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:4},navIconBox:{height:31,minWidth:32,alignItems:'center',justifyContent:'center'},
 navActive:{borderBottomWidth:2,borderColor:C.orange},
 plus:{width:49,height:49,borderRadius:25,backgroundColor:C.orange,alignItems:'center',justifyContent:'center',marginTop:-21,boxShadow:'0 5px 14px #FF8A0030'},
 navText:{fontSize:13,color:C.ink},navTextActive:{fontWeight:'800',color:'#98500C'},
 catalogueHeader:{paddingBottom:12,backgroundColor:'#F5EBE0',borderBottomWidth:1,borderColor:C.line},
 inlineIcon:{alignItems:'center',gap:5},
 detailTop:{alignItems:'center',paddingHorizontal:15,paddingVertical:14,gap:10},
 back:{width:44,minHeight:44,padding:0},
 detailHeading:{fontSize:21,fontWeight:'900'},
 detailSubtitle:{fontSize:12,lineHeight:18,color:C.muted,marginTop:3},
 detailHero:{overflow:'hidden',borderRadius:16,marginHorizontal:14,backgroundColor:'#F3E4D4'},
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
   backgroundColor:'#FBF1E7',borderColor:C.line,borderWidth:1,alignItems:'center',gap:7},
 selectionHint:{fontSize:13,color:'#854713',marginBottom:10},
 actionSelected:{backgroundColor:'#FFE3BD',borderColor:'#B06519'},
 actionText:{fontWeight:'700',fontSize:13,lineHeight:18,flex:1},
 noteLine:{alignItems:'flex-start',gap:7,paddingVertical:3},noteBullet:{color:C.orange,fontSize:10,marginTop:5},
 docRow:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.line,alignItems:'center',gap:5},
 docTitle:{fontSize:13,fontWeight:'800'},fileName:{fontSize:11,color:C.muted,marginTop:4},
 upload:{minHeight:44,paddingHorizontal:8,borderColor:C.line,borderWidth:1},
 remove:{minHeight:44,minWidth:44,paddingHorizontal:6,borderColor:C.line,borderWidth:1},
 uploadText:{fontWeight:'800',fontSize:12,color:C.brown},
 contextText:{fontSize:13,lineHeight:19,fontWeight:'700',color:'#784316',marginTop:6,marginBottom:6},
 warning:{fontSize:12,color:C.muted,marginTop:10,lineHeight:19},
 detailFooter:{paddingHorizontal:14,paddingVertical:8,backgroundColor:C.background,borderTopWidth:1,borderTopColor:C.line},
 changeAction:{alignSelf:'stretch',minHeight:44,marginTop:7},
 draftButton:{marginTop:12,minHeight:48},
 bigCTA:{minHeight:52,backgroundColor:C.orange},
 ctaRow:{alignItems:'center',justifyContent:'center',gap:10},
 ctaText:{color:C.ink,fontWeight:'900',fontSize:16},
 formInput:{height:48,backgroundColor:'white',borderRadius:13,borderWidth:1,borderColor:C.line,marginVertical:8,paddingHorizontal:12},
});



