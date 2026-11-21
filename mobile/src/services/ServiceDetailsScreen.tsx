/**
 * Service details — glass redesign (replaces `detailPage` / `detailCTA` in App.tsx).
 * Approved banner, favourite, About / Documents / Fees tabs, transaction picker, document drafts, and the
 * Start-request button that sits on the tab bar. State lives in App; this renders it and calls back.
 */
import React from 'react';
import {StyleSheet,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon,transactionIcon,type IconName} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {GlassButton,GlassCard,GlassField,GlassScreen,IconButton,Note,ScreenHeader,SectionTitle,g,rowFor,useReduceTransparency} from '../ui/Glass';
import {ScrollView} from '../navigation/TabBarLayout';
import {colors,layout,radius,space,type} from '../theme';
import {serviceDescription,serviceLabel,type Service} from '../services';
import {structureFor,tradeLicenceSectionTitles,wording,type ServiceAction} from '../serviceDetails';
import {LanguageButton} from '../ui/LanguageButton';
import {pick} from '../i18n';

export type DetailTab='about'|'documents'|'fees';
type DraftFile={name:string};

const COPY={
  ar:{back:'رجوع',languageA11y:'التبديل إلى الإنجليزية',tabs:'أقسام الخدمة',details:'تفاصيل الخدمة',docs:'المستندات المطلوبة',fees:'الرسوم والمدة',
    about:'عن الخدمة',transactions:'أبرز المعاملات المتاحة',chooseToContinue:'اختر المعاملة المطلوبة للمتابعة.',
    notes:'ملاحظات مهمة',reviewRequired:'تُؤكد المستندات والإجراءات بحسب المعاملة قبل التقديم.',
    chooseFirst:'اختر المعاملة أولاً لعرض مستنداتها.',noDocs:'يمكنك بدء الطلب دون إرفاق مستند في هذه الخطوة.',
    upload:'رفع الملف',replace:'استبدال',remove:'إزالة',formats:'PDF أو JPG أو PNG، بحد أقصى ٥ ميغابايت لكل ملف.',
    change:'تغيير المعاملة',choose:'اختيار المعاملة',
    feesNotice:'الرسوم الحكومية تُسدّد عبر الجهة الرسمية، وتُعرض رسوم خدمة تروثفل بشكل منفصل قبل الدفع.',
    feesPending:'الرسوم والمدة قيد التحقق لدى الجهة المختصة.',
    favAdd:'إضافة إلى المفضلة',favRemove:'إزالة من المفضلة',start:'بدء الطلب',selected:'محددة'},
  en:{back:'Back',languageA11y:'Switch to Arabic',tabs:'Service sections',details:'Service Details',docs:'Required Documents',fees:'Fees & Duration',
    about:'About this Service',transactions:'Main Transactions',chooseToContinue:'Choose a transaction to continue.',
    notes:'Important Notes',reviewRequired:'Documents and procedures will be confirmed for the selected transaction before submission.',
    chooseFirst:'Choose a transaction to see its documents.',noDocs:'You can start this request without attaching a document at this step.',
    upload:'Choose File',replace:'Replace',remove:'Remove',formats:'PDF, JPG or PNG, up to 5 MB per file.',
    change:'Change Transaction',choose:'Choose Transaction',
    feesNotice:'Government fees go to official authorities. TRUTHFUL handling fees are shown separately before payment.',
    feesPending:'Fees and timelines are pending confirmation from the relevant authority.',
    favAdd:'Add to Favorites',favRemove:'Remove from Favorites',start:'Start Request',selected:'selected'},
  ru:{back:'Назад',languageA11y:'Сменить язык',tabs:'Разделы услуги',details:'Об услуге',docs:'Документы',fees:'Сборы и сроки',
    about:'Об этой услуге',transactions:'Основные операции',chooseToContinue:'Выберите операцию, чтобы продолжить.',
    notes:'Важно',reviewRequired:'Документы и порядок будут подтверждены для выбранной операции до подачи.',
    chooseFirst:'Выберите операцию, чтобы увидеть её документы.',noDocs:'На этом шаге можно начать заявку без документов.',
    upload:'Выбрать файл',replace:'Заменить',remove:'Удалить',formats:'PDF, JPG или PNG, до 5 МБ на файл.',
    change:'Сменить операцию',choose:'Выбрать операцию',
    feesNotice:'Госпошлины перечисляются в госорганы. Сборы TRUTHFUL показываются отдельно до оплаты.',
    feesPending:'Сборы и сроки ожидают подтверждения компетентного органа.',
    favAdd:'В избранное',favRemove:'Убрать из избранного',start:'Подать заявку',selected:'выбрано'},
  zh:{back:'返回',languageA11y:'切换语言',tabs:'服务栏目',details:'服务详情',docs:'所需文件',fees:'费用与时长',
    about:'服务简介',transactions:'主要业务',chooseToContinue:'请选择一项业务以继续。',
    notes:'重要提示',reviewRequired:'提交前将针对所选业务确认文件和流程。',
    chooseFirst:'选择一项业务以查看所需文件。',noDocs:'此步骤无需上传文件即可发起申请。',
    upload:'选择文件',replace:'替换',remove:'删除',formats:'PDF、JPG 或 PNG，每个文件不超过 5 MB。',
    change:'更换业务',choose:'选择业务',
    feesNotice:'政府费用缴纳给官方部门。TRUTHFUL 服务费将在付款前单独列明。',
    feesPending:'费用和时长有待主管部门确认。',
    favAdd:'加入收藏',favRemove:'取消收藏',start:'发起申请',selected:'已选择'},
  fr:{back:'Retour',languageA11y:'Changer de langue',tabs:'Rubriques du service',details:'Détails',docs:'Documents',fees:'Frais et délais',
    about:'À propos de ce service',transactions:'Démarches principales',chooseToContinue:'Choisissez une démarche pour continuer.',
    notes:'À savoir',reviewRequired:'Les documents et la procédure seront confirmés pour la démarche choisie avant le dépôt.',
    chooseFirst:'Choisissez une démarche pour voir ses documents.',noDocs:'Vous pouvez lancer la demande sans joindre de document à cette étape.',
    upload:'Choisir un fichier',replace:'Remplacer',remove:'Supprimer',formats:'PDF, JPG ou PNG, 5 Mo maximum par fichier.',
    change:'Changer de démarche',choose:'Choisir la démarche',
    feesNotice:'Les frais publics sont versés aux autorités. Les frais de service TRUTHFUL sont indiqués séparément avant paiement.',
    feesPending:'Frais et délais en attente de confirmation par l’autorité compétente.',
    favAdd:'Ajouter aux favoris',favRemove:'Retirer des favoris',start:'Faire une demande',selected:'sélectionné'},
  es:{back:'Atrás',languageA11y:'Cambiar idioma',tabs:'Secciones del servicio',details:'Detalles',docs:'Documentos',fees:'Tasas y plazos',
    about:'Sobre este servicio',transactions:'Trámites principales',chooseToContinue:'Elija un trámite para continuar.',
    notes:'Importante',reviewRequired:'Los documentos y el procedimiento se confirmarán para el trámite elegido antes de presentarlo.',
    chooseFirst:'Elija un trámite para ver sus documentos.',noDocs:'Puede iniciar la solicitud sin adjuntar documentos en este paso.',
    upload:'Elegir archivo',replace:'Reemplazar',remove:'Quitar',formats:'PDF, JPG o PNG, hasta 5 MB por archivo.',
    change:'Cambiar trámite',choose:'Elegir trámite',
    feesNotice:'Las tasas oficiales se pagan a las autoridades. Las tarifas de TRUTHFUL se muestran por separado antes del pago.',
    feesPending:'Tasas y plazos pendientes de confirmación por la autoridad competente.',
    favAdd:'Añadir a favoritos',favRemove:'Quitar de favoritos',start:'Iniciar solicitud',selected:'seleccionado'},
} as const;

type Props={
  lang:Lang;service:Service;banner:React.ReactNode;onBack:()=>void;onLanguage:()=>void;
  scrollRef?:React.Ref<React.ComponentRef<typeof ScrollView>>;
  favorite:boolean;onToggleFavorite:()=>void;
  tab:DetailTab;onTab:(t:DetailTab)=>void;
  actionId:string|null;onSelectAction:(item:ServiceAction)=>void;needsAction:boolean;
  /** The pilot service collects documents on the About tab as well. */
  showDocumentsOnAbout:boolean;
  files:Record<string,DraftFile>;fields:Record<string,string>;
  onPick:(documentId:string)=>void;onRemoveFile:(documentId:string)=>void;onField:(documentId:string,value:string)=>void;
};

export function ServiceDetailsScreen(p:Props){
  const {lang,service,tab,actionId}=p;
  const t=pick(COPY,lang),ar=lang==='ar',row=rowFor(lang);
  const reduce=useReduceTransparency();
  const detail=structureFor(service.id);
  const action=detail.actions.find(a=>a.id===actionId);
  const documents=action?.documents??[];
  const tabs:[DetailTab,string,IconName][]=[['about',t.details,'info'],['documents',t.docs,'file'],['fees',t.fees,'clock']];

  const docPanel=<GlassCard reduce={reduce}>
    <SectionTitle lang={lang}>{t.docs}</SectionTitle>
    {action&&<Txt lang={lang} bold style={styles.context}>{wording(action,lang)}</Txt>}
    {!action?<Txt lang={lang} style={g.body}>{t.chooseFirst}</Txt>
      :documents.length===0?<Txt lang={lang} style={g.body}>{t.noDocs}</Txt>
      :<View>{documents.map((d,i)=>{const file=p.files[d.id],label=wording(d,lang);
        return <View key={d.id} style={[styles.docRow,i===documents.length-1&&g.noBorder]}>
          {d.field==='text'
            ?<GlassField lang={lang} label={label} placeholder={label} value={p.fields[d.id]??''} onChangeText={v=>p.onField(d.id,v)}/>
            :<View style={[styles.docLine,{flexDirection:row}]}>
              <Icon name={file?'check':'file'} size={20} color={file?colors.brand:colors.orange}/>
              <View style={g.flex1}>
                <Txt lang={lang} bold style={styles.docTitle}>{label}{d.optional?'':' *'}</Txt>
                {file&&<Txt lang="en" style={g.meta} numberOfLines={1}>{file.name}</Txt>}
              </View>
              <GlassButton lang={lang} compact icon="upload" label={file?t.replace:t.upload} accessibilityLabel={`${file?t.replace:t.upload} ${label}`} onPress={()=>p.onPick(d.id)}/>
              {file&&<IconButton icon="close" label={`${t.remove} ${label}`} onPress={()=>p.onRemoveFile(d.id)}/>}
            </View>}
        </View>;})}</View>}
    {action&&documents.some(d=>!d.field)&&<Txt lang={lang} style={g.meta}>{t.formats}</Txt>}
  </GlassCard>;

  return <GlassScreen scrollRef={p.scrollRef}>
    <ScreenHeader lang={lang} title={serviceLabel(service,lang)} subtitle={serviceDescription(service,lang)} backLabel={t.back} onBack={p.onBack}
      trailing={<LanguageButton lang={lang} onPress={p.onLanguage}/>}/>

    <View style={styles.banner}>{p.banner}</View>

    <View style={{alignItems:ar?'flex-end':'flex-start'}}>
      <ScalePressable accessibilityRole="button" accessibilityLabel={p.favorite?t.favRemove:t.favAdd} accessibilityState={{selected:p.favorite}} onPress={p.onToggleFavorite}
        style={[styles.favorite,{flexDirection:row},p.favorite&&styles.favoriteOn]}>
        <Icon name="star" size={18} color={colors.brand} filled={p.favorite}/>
        <Txt lang={lang} bold style={styles.favoriteText}>{p.favorite?t.favRemove:t.favAdd}</Txt>
      </ScalePressable>
    </View>

    <View accessibilityRole="tablist" accessibilityLabel={t.tabs} style={[styles.tabs,{flexDirection:row}]}>
      {tabs.map(([key,label,icon])=>{const selected=tab===key;
        return <ScalePressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected}} aria-selected={selected} onPress={()=>p.onTab(key)}
          style={[styles.tab,selected&&styles.tabOn]}>
          <Icon name={icon} size={17} color={selected?colors.brand:colors.muted}/>
          <Txt lang={lang} bold style={{...styles.tabText,...(selected?{color:colors.ink}:null)}}>{label}</Txt>
        </ScalePressable>;})}
    </View>

    {tab==='about'&&<>
      <GlassCard reduce={reduce}>
        <SectionTitle lang={lang}>{t.about}</SectionTitle>
        <Txt lang={lang} style={g.body}>{wording(detail.about,lang)}</Txt>
      </GlassCard>
      <GlassCard reduce={reduce} tone={p.needsAction?'warning':undefined}>
        <SectionTitle lang={lang}>{t.transactions}</SectionTitle>
        {p.needsAction&&<View accessibilityLiveRegion="polite"><Txt lang={lang} bold style={styles.hint}>{t.chooseToContinue}</Txt></View>}
        <View style={styles.actions}>
          {detail.actions.map(item=>{const selected=actionId===item.id;
            const group=service.id==='trade-licenses'?tradeLicenceSectionTitles[item.id]:undefined;
            return <React.Fragment key={item.id}>
              {group&&<Txt lang={lang} bold style={styles.group}>{wording(group,lang)}</Txt>}
              <ScalePressable accessibilityRole="button" accessibilityLabel={wording(item,lang)+(selected?`, ${t.selected}`:'')} accessibilityState={{selected}}
                onPress={()=>p.onSelectAction(item)} style={[styles.action,{flexDirection:row},selected&&styles.actionOn]}>
                <View style={[styles.actionIcon,selected&&styles.actionIconOn]}><Icon name={transactionIcon(item.icon)} size={18} color={selected?'#FFFFFF':colors.brand}/></View>
                <View style={g.flex1}><Txt lang={lang} bold={selected} style={styles.actionText}>{wording(item,lang)}</Txt></View>
                <Icon name={selected?'check':ar?'back':'next'} size={16} color={selected?colors.brand:colors.muted}/>
              </ScalePressable>
            </React.Fragment>;})}
        </View>
      </GlassCard>
      {p.showDocumentsOnAbout&&docPanel}
      {!p.showDocumentsOnAbout&&<GlassCard reduce={reduce}>
        <SectionTitle lang={lang}>{t.notes}</SectionTitle>
        {detail.notes.map((note,i)=><View key={i} style={[styles.note,{flexDirection:row}]}>
          <View style={styles.bullet}/>
          <View style={g.flex1}><Txt lang={lang} style={g.body}>{wording(note,lang)}</Txt></View>
        </View>)}
        {detail.contentStatus==='review-required'&&<Note lang={lang} tone="warning">{t.reviewRequired}</Note>}
      </GlassCard>}
    </>}

    {tab==='documents'&&<>
      {docPanel}
      <GlassButton lang={lang} icon="edit" label={action?t.change:t.choose} onPress={()=>p.onTab('about')}/>
    </>}

    {tab==='fees'&&<GlassCard reduce={reduce}>
      <SectionTitle lang={lang}>{t.fees}</SectionTitle>
      <Txt lang={lang} style={g.body}>{t.feesNotice}</Txt>
      {action&&<Txt lang={lang} bold style={styles.context}>{wording(action,lang)}</Txt>}
      <Note lang={lang} tone="warning">{t.feesPending}</Note>
    </GlassCard>}
  </GlassScreen>;
}

/** Start-request button shown above the tab bar on Service details. */
export function StartRequestBar({lang,onPress}:{lang:Lang;onPress:()=>void}){
  return <View style={styles.cta}>
    <GlassButton lang={lang} primary label={pick(COPY,lang).start} onPress={onPress}/>
  </View>;
}

const styles=StyleSheet.create({
  round:{width:layout.minTouch+2,height:layout.minTouch+2,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',
    backgroundColor:'rgba(255,255,255,0.42)',borderWidth:1,borderColor:'rgba(255,255,255,0.75)',overflow:'hidden'},
  languageText:{fontSize:type.callout,color:colors.brand},
  banner:{borderRadius:radius.card,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.8)'},
  favorite:{alignItems:'center',gap:space.sm,minHeight:layout.minTouch,paddingHorizontal:space.md,borderRadius:radius.pill,borderWidth:1,borderColor:colors.line,
    backgroundColor:'rgba(255,255,255,0.9)',overflow:'hidden'},
  favoriteOn:{backgroundColor:colors.brandTint,borderColor:'#D9BC7E'},
  favoriteText:{fontSize:type.footnote+1,color:colors.brand},
  tabs:{padding:4,gap:4,borderRadius:radius.control+4,backgroundColor:'rgba(91,100,117,0.12)'},
  tab:{flex:1,minHeight:layout.minTouch+12,borderRadius:radius.control,alignItems:'center',justifyContent:'center',gap:2,paddingHorizontal:space.xs,overflow:'hidden'},
  tabOn:{backgroundColor:colors.white},
  tabText:{fontSize:type.caption,lineHeight:16,color:colors.muted,textAlign:'center'},
  hint:{fontSize:type.subhead,lineHeight:22,color:'#76592A'},
  actions:{gap:space.sm},
  group:{fontSize:type.footnote+1,lineHeight:20,color:colors.brand,marginTop:space.sm},
  action:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+12,paddingHorizontal:space.md,paddingVertical:space.sm,borderRadius:radius.control+2,
    borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.7)',overflow:'hidden'},
  actionOn:{borderColor:colors.orange,backgroundColor:'#E8EDFB'},
  actionIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint},
  actionIconOn:{backgroundColor:colors.orange},
  actionText:{fontSize:type.subhead,lineHeight:22},
  note:{gap:space.sm,alignItems:'flex-start'},
  bullet:{width:6,height:6,borderRadius:3,marginTop:10,backgroundColor:colors.orange},
  context:{fontSize:type.subhead,lineHeight:22,color:colors.brand},
  docRow:{paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  docLine:{alignItems:'center',gap:space.sm},
  docTitle:{fontSize:type.subhead,lineHeight:22},
  cta:{paddingHorizontal:space.lg,paddingTop:space.sm,paddingBottom:space.xxl}, // clears the raised centre "+" of the floating tab bar
});
