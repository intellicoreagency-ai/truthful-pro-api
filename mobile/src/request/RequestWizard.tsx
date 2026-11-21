/**
 * Request wizard — glass redesign (moved from ClientWorkspace.tsx; logic unchanged unless noted).
 * Five steps: details → documents → review & consent → payment (not activated) → confirm. Save draft at any step.
 * Fixed: Continue now says what is missing; documents that stop applying (age rule) are not submitted.
 */
import React,{useEffect,useRef,useState} from 'react';
import {BackHandler,StyleSheet,View} from 'react-native';
import {Icon} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {CheckRow,GlassButton,GlassCard,GlassField,GlassScreen,IconButton,Note,ScreenHeader,SectionTitle,g,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,radius,space,type} from '../theme';
import {applicantAge,makeId,phoneDigits,type ClientFile,type ClientRequest} from '../clientModel';
import {pickClientFile,previewFile} from '../clientStorage';
import {apiEnabled,hasSession} from '../api';
import {LEGAL_VERSION} from '../legal';
import type {ServiceAction} from '../serviceDetails';
import {tr} from '../i18n';

const digit=(n:number,lang:Lang)=>lang==='ar'?String(n).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]):String(n);

type Props={lang:Lang;action:ServiceAction;serviceId:string;create:(r:ClientRequest)=>boolean;onDone:()=>void;onBack:()=>void;
  defaults:{name:string;phone:string};initial?:ClientRequest;onKeep?:(r:ClientRequest)=>void;onLegal?:(k:'terms'|'privacy')=>void};

export function RequestWizard({lang,action,serviceId,create,onDone,onBack,defaults,initial,onKeep,onLegal}:Props){
  const live=apiEnabled&&hasSession();const ar=lang==='ar',row=rowFor(lang),tx=(a:string,e:string)=>ar?a:e;
  const reduce=useReduceTransparency();
  const idRef=useRef(initial?.id??makeId()),createdRef=useRef(initial?.createdAt??new Date().toISOString()),doneRef=useRef(false);
  const [step,setStep]=useState(1),[name,setName]=useState(initial?.name??defaults.name),[phone,setPhone]=useState(initial?.phone??defaults.phone),
    [fields,setFields]=useState<Record<string,string>>(initial?.fields??{}),
    [files,setFiles]=useState<Record<string,ClientFile>>(Object.fromEntries(action.documents.flatMap(d=>{const f=initial?.files.find(f=>f.label.ar===d.ar&&f.kind==='source');return f?[[d.id,f]]:[]}))),
    [accepted,setAccepted]=useState(false),[terms,setTerms]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const age=applicantAge(fields['applicant-dob']??'');const hasAgeRule=action.documents.some(d=>d.minimumAge!==undefined);
  const applicableDocs=action.documents.filter(d=>d.minimumAge===undefined||age===null||age>=d.minimumAge);const required=applicableDocs.filter(d=>!d.optional);
  const tradeNames=['trade-name-1','trade-name-2','trade-name-3'].filter(id=>applicableDocs.some(d=>d.id===id)).map(id=>(fields[id]??'').trim().toLocaleLowerCase()).filter(Boolean);
  const namesDistinct=new Set(tradeNames).size===tradeNames.length;
  const valid=step===1?!!name.trim()&&phoneDigits(phone).length>=7&&(!hasAgeRule||age!==null):step===2?required.every(d=>d.field?!!fields[d.id]?.trim():!!files[d.id])&&namesDistinct:step===3?accepted:true;
  /** Plain-language reason the step cannot continue yet (new). */
  const missing=step===1?(!name.trim()?tx('أدخل الاسم الكامل.','Enter your full name.'):phoneDigits(phone).length<7?tx('أدخل رقم هاتف صحيح.','Enter a valid phone number.'):hasAgeRule&&age===null?tx('أدخل تاريخ ميلاد صحيحاً بصيغة YYYY-MM-DD.','Enter a valid date of birth as YYYY-MM-DD.'):'')
    :step===2?(!namesDistinct?tx('يجب أن تكون الأسماء الثلاثة مختلفة.','The three names must be different.'):(()=>{const n=required.filter(d=>d.field?!fields[d.id]?.trim():!files[d.id]).length;return n?tx(`بقي ${digit(n,lang)} من المطلوب.`,`${n} required item${n===1?'':'s'} left.`):''})())
    :step===3&&!accepted?tx('أكّد صحة البيانات ووافق على الشروط للمتابعة.','Confirm your details and accept the terms to continue.'):'';

  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(step>1){setStep(step-1);return true}return false});return ()=>sub.remove()},[step]);
  const latest=useRef<()=>ClientRequest>(()=>build('draft'));latest.current=()=>build('draft');
  useEffect(()=>()=>{if(!doneRef.current)onKeep?.(latest.current())},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit=(status:'draft'|'submitted',failure:string)=>{if(doneRef.current)return;doneRef.current=true;if(create(build(status)))onDone();else{doneRef.current=false;setMessage(failure)}};
  const build=(status:'draft'|'submitted'):ClientRequest=>{const now=new Date().toISOString();
    // A submitted request carries only documents that apply (e.g. no medical certificate after the date of birth changed to under 18).
    const sent=status==='submitted'?applicableDocs.flatMap(d=>files[d.id]?[files[d.id]]:[]):Object.values(files);
    return {id:idRef.current,serviceId,actionId:action.id,title:{ar:action.ar,en:action.en},createdAt:createdRef.current,updatedAt:now,status,stage:1,name:name.trim(),phone:phone.trim(),fields,files:sent,missing:[],...(initial?.renewalOf?{renewalOf:initial.renewalOf}:{}),events:[...(initial?.events??[]),...(initial?.renewalOf&&!initial.events.length?[{id:makeId(),at:now,text:{ar:'طلب تجديد مرتبط بالطلب #'+initial.renewalOf,en:'Renewal linked to request #'+initial.renewalOf}}]:[]),{id:makeId(),at:now,text:{ar:status==='draft'?(live?'حُفظت مسودة':'حُفظت مسودة محلية'):(live?'تم إرسال الطلب':'تم إنشاء طلب تجريبي محلي'),en:status==='draft'?(live?'Draft saved':'Local draft saved'):(live?'Request sent':'Local demonstration request created')}}],money:{government:0,handling:0,tax:0,extra:0,paid:0,refunded:0,quoted:false},...(accepted?{termsVersion:live?LEGAL_VERSION:'preview-v1',termsAcceptedAt:now}:{})}};
  const upload=(d:ServiceAction['documents'][number])=>{if(busy)return;setBusy(true);setMessage('');void pickClientFile({ar:d.ar,en:d.en}).then(f=>{if(f)setFiles(a=>({...a,[d.id]:f}))}).catch(()=>setMessage(tx('تعذر رفع الملف. تحقق من الصيغة والحجم وأعد المحاولة.','Upload failed. Check format and size, then retry.'))).finally(()=>setBusy(false))};
  const labels=[tx('البيانات','Details'),tx('المستندات','Documents'),tx('المراجعة','Review'),tx('الدفع','Payment'),tx('التأكيد','Confirm')];

  return <GlassScreen>
    <ScreenHeader lang={lang} title={tx('بدء معاملة','Start request')} subtitle={tr(action,lang)} backLabel={tx('رجوع','Back')} onBack={()=>step>1?setStep(step-1):onBack()}/>
    <Note lang={lang}>{live?tx('يُحفظ طلبك ومستنداتك مشفّرة في حسابك. لا تُحصَّل أي مبالغ داخل التطبيق.','Your request and documents are stored encrypted in your account. No payments are collected in the app.'):tx('تجربة محلية. لا يتم تقديم المعاملة للجهة أو تحصيل مبالغ.','Local demonstration. No authority submission or payment is made.')}</Note>

    {/* Stepper */}
    <View accessible accessibilityRole="progressbar" accessibilityLabel={tx(`الخطوة ${digit(step,lang)} من ${digit(5,lang)}: ${labels[step-1]}`,`Step ${step} of 5: ${labels[step-1]}`)}
      accessibilityValue={{min:1,max:5,now:step}} style={{flexDirection:row}}>
      {labels.map((v,i)=>{const done=i<step-1,now=i===step-1;return <View key={v} style={styles.step}>
        {i<4&&<View style={[styles.connector,ar?{right:'50%'}:{left:'50%'},done&&styles.connectorDone]}/>}
        <View style={[styles.circle,(done||now)&&styles.circleOn]}>{done?<Icon name="check" size={14} color="#FFFFFF"/>:<Txt lang={lang} bold style={{...styles.circleText,...(now?{color:'#FFFFFF'}:null)}}>{digit(i+1,lang)}</Txt>}</View>
        <Txt lang={lang} bold={now} style={{...styles.stepText,...(now?{color:colors.brand}:null)}}>{v}</Txt>
      </View>})}
    </View>
    {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="danger">{message}</Note></View>}

    {step===1&&<GlassCard reduce={reduce}>
      <SectionTitle lang={lang}>{tx('بيانات مقدم الطلب','Applicant details')}</SectionTitle>
      <GlassField lang={lang} label={tx('الاسم الكامل','Full name')} value={name} onChangeText={setName} autoComplete="name"/>
      <GlassField lang={lang} label={tx('رقم الهاتف','Phone number')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoComplete="tel"/>
      {hasAgeRule&&<>
        <GlassField lang={lang} label={tx('تاريخ ميلاد المكفول (YYYY-MM-DD)','Sponsored person date of birth (YYYY-MM-DD)')} accessibilityLabel={tx('تاريخ ميلاد المكفول','Sponsored person date of birth')}
          placeholder="YYYY-MM-DD" value={fields['applicant-dob']??''} onChangeText={value=>setFields(a=>({...a,'applicant-dob':value}))}/>
        <Txt lang={lang} style={g.meta}>{tx('يُطلب الفحص الطبي لمن أتم ١٨ سنة فقط.','Medical fitness is required for applicants aged 18 or above.')}</Txt>
      </>}
    </GlassCard>}

    {step===2&&<>
      {applicableDocs.map(d=>{const f=files[d.id];return <GlassCard key={d.id} reduce={reduce}>
        <View style={[styles.docHead,{flexDirection:row}]}>
          <Icon name={f||d.field&&fields[d.id]?.trim()?'check':'file'} size={20} color={f?colors.brand:colors.orange}/>
          <View style={g.flex1}><Txt lang={lang} bold style={styles.docTitle}>{tr(d,lang)}{d.optional?(/if applicable|حسب الحالة|إن وجد/i.test(tr(d,lang))?'':tx(' (حسب الحالة)',' (if applicable)')):' *'}</Txt></View>
        </View>
        {d.id==='trade-name-1'&&<Txt lang={lang} style={g.meta}>{tx('أدخل ثلاثة أسماء مختلفة حسب الأولوية. الحجز مشروط بتوافر الاسم وموافقة الجهة المختصة.','Enter three different names in order of preference. Reservation depends on availability and approval by the competent authority.')}</Txt>}
        {d.id==='trade-name-3'&&!namesDistinct&&<Note lang={lang} tone="danger">{tx('يجب أن تكون الأسماء الثلاثة مختلفة.','The three names must be different.')}</Note>}
        {d.field
          ?<GlassField lang={lang} label={tr(d,lang)} value={fields[d.id]??''} onChangeText={value=>setFields(a=>({...a,[d.id]:value}))}/>
          :<>
            {f?<View style={[styles.fileChip,{flexDirection:row}]}>
                <Icon name="file" size={20} color={colors.brand}/>
                <View style={g.flex1}><Txt lang="en" bold style={styles.fileName} numberOfLines={1}>{f.name}</Txt></View>
                <IconButton icon="eye" label={tx('معاينة ','Preview ')+tr(d,lang)} onPress={()=>void previewFile(f).catch(()=>setMessage(tx('تعذرت المعاينة','Preview failed')))}/>
                <IconButton icon="close" label={tx('إزالة المرفق ','Remove attachment ')+tr(d,lang)} onPress={()=>setFiles(a=>{const n={...a};delete n[d.id];return n})}/>
              </View>
              :<Txt lang={lang} style={g.meta}>{tx('PDF أو JPG أو PNG • حتى ٥ ميغابايت','PDF, JPG or PNG • up to 5 MB')}</Txt>}
            <GlassButton lang={lang} icon="upload" busy={busy} label={f?tx('استبدال الملف','Replace file'):tx('رفع الملف','Upload file')} accessibilityLabel={(f?tx('استبدال ','Replace '):tx('رفع ','Upload '))+tr(d,lang)} onPress={()=>upload(d)}/>
          </>}
      </GlassCard>})}
      {!action.documents.length&&<Note lang={lang}>{tx('لا مستندات مطلوبة في هذه الخطوة.','No documents required at this step.')}</Note>}
    </>}

    {step===3&&<GlassCard reduce={reduce}>
      <SectionTitle lang={lang}>{tx('راجع بياناتك ومرفقاتك','Review your details and files')}</SectionTitle>
      <View>
        <View style={styles.reviewRow}><Txt lang={lang} style={g.meta}>{tx('الاسم','Name')}</Txt><Txt lang={lang} bold style={g.valueText}>{name}</Txt></View>
        <View style={styles.reviewRow}><Txt lang={lang} style={g.meta}>{tx('الهاتف','Phone')}</Txt><Txt lang="en" bold style={{...g.valueText,textAlign:ar?'right':'left'}}>{phone}</Txt></View>
        {applicableDocs.filter(d=>files[d.id]).map(d=><View key={d.id} style={styles.reviewRow}><Txt lang={lang} style={g.meta}>{tr(d,lang)}</Txt><Txt lang="en" bold style={{...g.valueText,textAlign:ar?'right':'left'}}>{files[d.id].name}</Txt></View>)}
        {Object.entries(fields).filter(([,value])=>value.trim()).map(([id,value])=><View key={id} style={styles.reviewRow}>
          <Txt lang={lang} style={g.meta}>{id==='applicant-dob'?tx('تاريخ ميلاد المكفول','Sponsored person date of birth'):action.documents.find(d=>d.id===id)?.[lang]??id}</Txt>
          <Txt lang={lang} bold style={g.valueText}>{value}</Txt></View>)}
      </View>
      <CheckRow lang={lang} checked={accepted} onPress={()=>setAccepted(!accepted)}
        label={live?tx('أؤكد صحة بياناتي ومستنداتي وأوافق على شروط الاستخدام وسياسة الخصوصية','I confirm my details and documents are accurate and I accept the Terms of Use and Privacy Policy'):tx('أوافق على شروط المعاينة المحلية','I accept the local preview terms')}/>
      {live&&onLegal?<View style={[styles.links,{flexDirection:row}]}>
          <View style={g.flex1}><GlassButton lang={lang} compact label={tx('شروط الاستخدام','Terms of Use')} onPress={()=>onLegal('terms')}/></View>
          <View style={g.flex1}><GlassButton lang={lang} compact label={tx('سياسة الخصوصية','Privacy Policy')} onPress={()=>onLegal('privacy')}/></View>
        </View>
        :<GlassButton lang={lang} compact icon={terms?'close':'info'} label={tx('قراءة الشروط والخصوصية','Read terms & privacy')} onPress={()=>setTerms(!terms)}/>}
      {!live&&terms&&<Note lang={lang}>{tx('هذه نسخة معاينة تُحفظ بياناتها وملفاتها على هذا الجهاز. لا تُرسل مستندات للجهات الحكومية ولا تُحصّل رسوم. يمكنك مشاركة الملفات التي تختارها بنفسك. شروط الخدمة وسياسة الاحتفاظ النهائية مطلوبة قبل الإطلاق الحي.','This preview stores data and files on this device. It does not submit documents to authorities or collect fees. You can share selected files yourself. Final service terms and retention policy are required before live launch.')}</Note>}
    </GlassCard>}

    {step===4&&<GlassCard reduce={reduce}>
      <View style={styles.center}><View style={styles.bigIcon}><Icon name="lock" size={30} color={colors.brand}/></View>
        <Txt lang={lang} bold style={g.sectionTitle}>{tx('الدفع غير مفعّل','Payment is not activated')}</Txt>
        <Txt lang={lang} style={{...g.body,textAlign:'center'}}>{live?tx('تُعرض الرسوم بعد اعتماد عرض السعر. لا يُطلب دفع داخل التطبيق.','Fees appear after an approved quote. No payment is requested in the app.'):tx('تُعرض الرسوم بعد اعتماد عرض السعر. لا توجد مطالبة دفع ولا تسجيل دفعة في المعاينة.','Fees appear after an approved quote. No payment is requested or recorded in this preview.')}</Txt>
      </View>
      <GlassButton lang={lang} disabled label={tx('الدفع','Pay')} onPress={()=>{}}/>
    </GlassCard>}

    {step===5&&<GlassCard reduce={reduce}>
      <View style={styles.center}><View style={[styles.bigIcon,styles.bigIconOn]}><Icon name="check" size={32} color="#FFFFFF"/></View>
        <Txt lang={lang} bold style={{...g.sectionTitle,textAlign:'center'}}>{live?tx('راجع ثم أكّد إرسال طلبك','Review, then confirm sending your request'):tx('راجع ثم أكد إنشاء الطلب التجريبي','Confirm creation of your demonstration request')}</Txt>
        <Txt lang={lang} style={{...g.body,textAlign:'center'}}>{live?tx('سيُحفظ الطلب في حسابك ويظهر في «طلباتي». لا يعني ذلك تقديمه للجهة الحكومية بعد.','The request is saved to your account and appears under My Requests. This does not yet submit it to a government authority.'):tx('سيظهر الطلب في «طلباتي» على هذا الجهاز. لا يعني ذلك تقديمه للجهة الحكومية.','The request will appear under My Requests on this device. This does not submit it to a government authority.')}</Txt>
      </View>
      <GlassButton lang={lang} primary busy={busy} label={live?tx('تأكيد الطلب','Confirm request'):tx('تأكيد الطلب التجريبي','Confirm demo request')} onPress={()=>commit('submitted',tx('تعذر الحفظ. لم يُنشأ الطلب.','Save failed. Request was not created.'))}/>
    </GlassCard>}

    <View style={styles.footer}>
      {step<5&&!valid&&!!missing&&<Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{missing}</Txt>}
      {step<5&&<GlassButton lang={lang} primary disabled={!valid||busy} label={tx('التالي','Continue')} onPress={()=>{setMessage('');setStep(step+1)}}/>}
      <GlassButton lang={lang} icon="folder" disabled={busy||!name.trim()} label={tx('حفظ مسودة','Save draft')} onPress={()=>commit('draft',tx('تعذر الحفظ.','Save failed.'))}/>
      {!name.trim()&&<Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{tx('أدخل الاسم لحفظ مسودة.','Enter a name to save a draft.')}</Txt>}
    </View>
  </GlassScreen>;
}

const styles=StyleSheet.create({
  step:{flex:1,alignItems:'center',gap:space.xs},
  connector:{position:'absolute',top:14,width:'100%',height:2,backgroundColor:colors.line},
  connectorDone:{backgroundColor:colors.orange},
  circle:{width:30,height:30,borderRadius:15,borderWidth:2,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},
  circleOn:{backgroundColor:colors.orange,borderColor:colors.orange},
  circleText:{fontSize:type.footnote,lineHeight:18,color:colors.muted,textAlign:'center'},
  stepText:{fontSize:type.caption,lineHeight:18,textAlign:'center',color:colors.muted},
  docHead:{alignItems:'center',gap:space.sm},
  docTitle:{fontSize:type.callout,lineHeight:24},
  fileChip:{alignItems:'center',gap:space.sm,paddingVertical:space.xs,paddingHorizontal:space.md,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.7)'},
  fileName:{fontSize:type.subhead,lineHeight:22},
  reviewRow:{gap:2,paddingVertical:space.sm,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  links:{gap:space.sm},
  center:{alignItems:'center',gap:space.sm},
  bigIcon:{width:60,height:60,borderRadius:30,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint},
  bigIconOn:{backgroundColor:colors.orange},
  footer:{gap:space.sm},
});
