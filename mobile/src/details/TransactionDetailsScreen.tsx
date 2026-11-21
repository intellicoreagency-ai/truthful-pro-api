/**
 * Request details — glass redesign (replaces the legacy `DetailDesign`).
 *
 * Shown by ClientWorkspace for the selected request. ClientWorkspace keeps ownership of state and side effects
 * (saving, sharing, files, receipt, problem report, payments) and of the Android back button for this layer
 * (share sheet → files/missing tab → details → list); this component renders them and calls back.
 *
 *  - Data: the synced `ClientRequest` is shown at once; on open a fresh copy comes from `fetchRequest`
 *    (GET /v1/requests/:id) unless local changes are still waiting to upload. Pull-to-refresh runs the app's full sync.
 *  - Fonts: `Txt` (Cairo for Arabic, system font for English). Icons: `Icon`. Touch: `Pressable` from Touch.tsx.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Linking,Platform,RefreshControl,StyleSheet,View} from 'react-native';
import {Icon} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {GlassButton,GlassCard,GlassField,GlassScreen,IconButton,Note,ScreenHeader,SectionTitle,StageTracker,StatusBadge,Tag,ValueRow,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,onGlass,radius,space,type} from '../theme';
import {dateText,remaining,total,type ClientFile,type ClientRequest} from '../clientModel';
import {ApiError,apiEnabled,fetchRequest,hasSession,needsSync} from '../api';
import {pick,tr} from '../i18n';

const SUPPORT_WHATSAPP='https://wa.me/971585144005';
const SUPPORT_PHONE='tel:+971525949522';

const COPY={
  ar:{title:'تفاصيل المعاملة',back:'رجوع',reference:'رقم الطلب',sample:'بيانات توضيحية',status:'الحالة',
    submitted:'التقديم',completed:'الإنجاز',expected:'الإنجاز المتوقع',received:'الاستلام',delivered:'التسليم',
    actionNeeded:'مطلوب منك',whereAmI:'أين وصلت معاملتي؟',completeDocs:'استكمال المستندات',
    progress:'حالة المعاملة',stage:(n:string,of:string)=>`المرحلة ${n} من ${of}`,
    financial:'التفاصيل المالية',inAed:'جميع المبالغ بالدرهم الإماراتي',govFeesAuthority:'رسوم حكومية (للجهة مباشرة)',govFees:'الرسوم الحكومية',
    companyFee:'أتعاب الشركة',tax:'الضريبة',taxOff:'غير مهيأة',total:'الإجمالي',paid:'المدفوع',due:'المتبقي',
    awaitingQuote:'بانتظار عرض السعر المعتمد',illustrative:'أرقام توضيحية وليست تسعيرة معتمدة',
    finalDocs:'الملفات النهائية',noFinal:'لم تُسلّم ملفات نهائية بعد',allFiles:'كل ملفات المعاملة',view:'معاينة',save:'تنزيل',
    delivery:'حالة التسليم',receiptDone:'تم تأكيد الاستلام',receiptWaiting:'بانتظار تأكيد الاستلام',confirmReceipt:'تأكيد استلام الملفات',
    reportProblem:'الإبلاغ عن مشكلة',closeReport:'إغلاق البلاغ',issueLabel:'وصف المشكلة',issuePlaceholder:'اشرح المشكلة',sendIssue:'إرسال البلاغ للفريق',
    issueSent:'سُجّل بلاغك وسيتابعه الفريق.',
    history:'سجل المعاملة',noUpdates:'لا توجد تحديثات إضافية',
    exportWeb:'تنزيل ملخص PDF',exportNative:'مشاركة ملخص نصي',share:'مشاركة',
    contactSupport:'تواصل مع الدعم',contactSupportA11y:'التواصل مع الدعم عبر واتساب',opening:'جارٍ الفتح…',
    supportError:'تعذّر فتح واتساب أو الهاتف. اتصل بنا على ‎+971 52 594 9522',
    refreshing:'جارٍ تحديث المعاملة…',offline:'تعذّر التحديث. تُعرض آخر بيانات محفوظة.',notFound:'لم تعد هذه المعاملة متاحة في حسابك.',retry:'إعادة المحاولة',
    supportText:(ref:string)=>`مرحباً، أحتاج مساعدة بخصوص المعاملة رقم ${ref}`},
  en:{title:'Request details',back:'Go back',reference:'Request',sample:'Sample data',status:'Status',
    submitted:'Submitted',completed:'Completed',expected:'Expected',received:'Received',delivered:'Delivered',
    actionNeeded:'Action needed',whereAmI:'Where is my transaction?',completeDocs:'Complete documents',
    progress:'Request status',stage:(n:string,of:string)=>`Stage ${n} of ${of}`,
    financial:'Financial details',inAed:'All amounts in UAE dirhams',govFeesAuthority:'Govt fees (paid to authority)',govFees:'Government fees',
    companyFee:'Company fee',tax:'Tax',taxOff:'Not configured',total:'Total',paid:'Paid',due:'Due',
    awaitingQuote:'Awaiting an approved quote',illustrative:'Illustrative amounts, not an approved quotation',
    finalDocs:'Final documents',noFinal:'No final files delivered yet',allFiles:'All request files',view:'View',save:'Save',
    delivery:'Delivery status',receiptDone:'Receipt confirmed',receiptWaiting:'Awaiting receipt confirmation',confirmReceipt:'Confirm file receipt',
    reportProblem:'Report a problem',closeReport:'Close report',issueLabel:'Describe the issue',issuePlaceholder:'Describe the problem',sendIssue:'Send the report to the team',
    issueSent:'Your report is recorded; the team will follow up.',
    history:'Request history',noUpdates:'No additional updates',
    exportWeb:'Save PDF summary',exportNative:'Share text summary',share:'Share',
    contactSupport:'Contact Support',contactSupportA11y:'Contact support on WhatsApp',opening:'Opening…',
    supportError:'Could not open WhatsApp or the phone app. Call us on +971 52 594 9522.',
    refreshing:'Updating this request…',offline:'Could not refresh. Showing the last saved data.',notFound:'This request is no longer available in your account.',retry:'Try again',
    supportText:(ref:string)=>`Hello, I need help with request ${ref}`},
  ru:{title:'Детали заявки',back:'Назад',reference:'Заявка',sample:'Пример данных',status:'Статус',
    submitted:'Подана',completed:'Завершена',expected:'Ожидается',received:'Получено',delivered:'Выдано',
    actionNeeded:'Требуется действие',whereAmI:'Где моя заявка?',completeDocs:'Дополнить документы',
    progress:'Статус заявки',stage:(n:string,of:string)=>`Этап ${n} из ${of}`,
    financial:'Финансы',inAed:'Все суммы в дирхамах ОАЭ',govFeesAuthority:'Госпошлины (оплачиваются органу)',govFees:'Госпошлины',
    companyFee:'Сбор компании',tax:'Налог',taxOff:'Не настроен',total:'Итого',paid:'Оплачено',due:'К оплате',
    awaitingQuote:'Ожидается утверждённый расчёт',illustrative:'Ориентировочные суммы, не утверждённый расчёт',
    finalDocs:'Итоговые документы',noFinal:'Итоговые файлы ещё не выданы',allFiles:'Все файлы заявки',view:'Открыть',save:'Сохранить',
    delivery:'Статус выдачи',receiptDone:'Получение подтверждено',receiptWaiting:'Ожидается подтверждение получения',confirmReceipt:'Подтвердить получение файлов',
    reportProblem:'Сообщить о проблеме',closeReport:'Закрыть',issueLabel:'Опишите проблему',issuePlaceholder:'Опишите проблему',sendIssue:'Отправить команде',
    issueSent:'Обращение зарегистрировано, команда свяжется с вами.',
    history:'История заявки',noUpdates:'Других обновлений нет',
    exportWeb:'Сохранить сводку в PDF',exportNative:'Поделиться сводкой',share:'Поделиться',
    contactSupport:'Связаться с поддержкой',contactSupportA11y:'Написать в поддержку в WhatsApp',opening:'Открываем…',
    supportError:'Не удалось открыть WhatsApp или телефон. Позвоните нам: +971 52 594 9522.',
    refreshing:'Обновляем заявку…',offline:'Не удалось обновить. Показаны последние сохранённые данные.',notFound:'Эта заявка больше недоступна в вашем профиле.',retry:'Повторить',
    supportText:(ref:string)=>`Здравствуйте, мне нужна помощь по заявке ${ref}`},
  zh:{title:'申请详情',back:'返回',reference:'申请',sample:'示例数据',status:'状态',
    submitted:'已提交',completed:'已完成',expected:'预计',received:'已收到',delivered:'已交付',
    actionNeeded:'需要处理',whereAmI:'我的业务进展到哪了？',completeDocs:'补充文件',
    progress:'申请状态',stage:(n:string,of:string)=>`第 ${n} 步，共 ${of} 步`,
    financial:'费用明细',inAed:'所有金额均以阿联酋迪拉姆计',govFeesAuthority:'政府费用（缴纳给主管部门）',govFees:'政府费用',
    companyFee:'公司服务费',tax:'税费',taxOff:'未设置',total:'合计',paid:'已付',due:'待付',
    awaitingQuote:'等待已批准的报价',illustrative:'示意金额，并非已批准报价',
    finalDocs:'最终文件',noFinal:'尚未交付最终文件',allFiles:'申请的全部文件',view:'查看',save:'保存',
    delivery:'交付状态',receiptDone:'已确认收到',receiptWaiting:'等待确认收到',confirmReceipt:'确认已收到文件',
    reportProblem:'报告问题',closeReport:'关闭',issueLabel:'描述问题',issuePlaceholder:'请描述问题',sendIssue:'发送给团队',
    issueSent:'您的反馈已记录，团队将跟进。',
    history:'申请记录',noUpdates:'暂无其他更新',
    exportWeb:'保存 PDF 摘要',exportNative:'分享文本摘要',share:'分享',
    contactSupport:'联系客服',contactSupportA11y:'通过 WhatsApp 联系客服',opening:'正在打开…',
    supportError:'无法打开 WhatsApp 或电话。请致电 +971 52 594 9522。',
    refreshing:'正在更新此申请…',offline:'无法刷新，正在显示上次保存的数据。',notFound:'此申请已不在您的账户中。',retry:'重试',
    supportText:(ref:string)=>`您好，我需要关于申请 ${ref} 的帮助`},
  fr:{title:'Détails de la demande',back:'Retour',reference:'Demande',sample:'Données d’exemple',status:'Statut',
    submitted:'Envoyée',completed:'Terminée',expected:'Prévue',received:'Reçu',delivered:'Remis',
    actionNeeded:'Action requise',whereAmI:'Où en est ma démarche ?',completeDocs:'Compléter les documents',
    progress:'État de la demande',stage:(n:string,of:string)=>`Étape ${n} sur ${of}`,
    financial:'Détails financiers',inAed:'Montants en dirhams des Émirats',govFeesAuthority:'Frais publics (versés à l’autorité)',govFees:'Frais publics',
    companyFee:'Frais de service',tax:'Taxe',taxOff:'Non configurée',total:'Total',paid:'Payé',due:'Reste dû',
    awaitingQuote:'Devis validé en attente',illustrative:'Montants indicatifs, non un devis validé',
    finalDocs:'Documents finaux',noFinal:'Aucun document final remis pour l’instant',allFiles:'Tous les fichiers de la demande',view:'Voir',save:'Enregistrer',
    delivery:'Remise',receiptDone:'Réception confirmée',receiptWaiting:'Confirmation de réception en attente',confirmReceipt:'Confirmer la réception des fichiers',
    reportProblem:'Signaler un problème',closeReport:'Fermer',issueLabel:'Décrivez le problème',issuePlaceholder:'Décrivez le problème',sendIssue:'Envoyer à l’équipe',
    issueSent:'Votre signalement est enregistré ; l’équipe va le traiter.',
    history:'Historique de la demande',noUpdates:'Aucune autre mise à jour',
    exportWeb:'Enregistrer le résumé PDF',exportNative:'Partager le résumé',share:'Partager',
    contactSupport:'Contacter l’assistance',contactSupportA11y:'Contacter l’assistance sur WhatsApp',opening:'Ouverture…',
    supportError:'Impossible d’ouvrir WhatsApp ou le téléphone. Appelez-nous au +971 52 594 9522.',
    refreshing:'Mise à jour de la demande…',offline:'Actualisation impossible. Dernières données enregistrées affichées.',notFound:'Cette demande n’est plus disponible dans votre compte.',retry:'Réessayer',
    supportText:(ref:string)=>`Bonjour, j’ai besoin d’aide pour la demande ${ref}`},
  es:{title:'Detalles de la solicitud',back:'Atrás',reference:'Solicitud',sample:'Datos de ejemplo',status:'Estado',
    submitted:'Enviada',completed:'Completada',expected:'Prevista',received:'Recibido',delivered:'Entregado',
    actionNeeded:'Acción requerida',whereAmI:'¿Dónde está mi trámite?',completeDocs:'Completar documentos',
    progress:'Estado de la solicitud',stage:(n:string,of:string)=>`Etapa ${n} de ${of}`,
    financial:'Detalles económicos',inAed:'Importes en dírhams de los EAU',govFeesAuthority:'Tasas oficiales (pagadas a la autoridad)',govFees:'Tasas oficiales',
    companyFee:'Tarifa de servicio',tax:'Impuesto',taxOff:'No configurado',total:'Total',paid:'Pagado',due:'Pendiente',
    awaitingQuote:'Pendiente de presupuesto aprobado',illustrative:'Importes orientativos, no un presupuesto aprobado',
    finalDocs:'Documentos finales',noFinal:'Aún no se han entregado documentos finales',allFiles:'Todos los archivos',view:'Ver',save:'Guardar',
    delivery:'Estado de entrega',receiptDone:'Recepción confirmada',receiptWaiting:'Pendiente de confirmar la recepción',confirmReceipt:'Confirmar la recepción',
    reportProblem:'Informar de un problema',closeReport:'Cerrar',issueLabel:'Describa el problema',issuePlaceholder:'Describa el problema',sendIssue:'Enviar al equipo',
    issueSent:'Su aviso se ha registrado; el equipo hará el seguimiento.',
    history:'Historial de la solicitud',noUpdates:'No hay más novedades',
    exportWeb:'Guardar resumen PDF',exportNative:'Compartir resumen',share:'Compartir',
    contactSupport:'Contactar con soporte',contactSupportA11y:'Contactar con soporte por WhatsApp',opening:'Abriendo…',
    supportError:'No se pudo abrir WhatsApp ni el teléfono. Llámenos al +971 52 594 9522.',
    refreshing:'Actualizando la solicitud…',offline:'No se pudo actualizar. Se muestran los últimos datos guardados.',notFound:'Esta solicitud ya no está disponible en su cuenta.',retry:'Reintentar',
    supportText:(ref:string)=>`Hola, necesito ayuda con la solicitud ${ref}`},
} as const;

const amount=(fils:number)=>ltr((fils/100).toFixed(2));

export type DetailsActions={
  onFiles:()=>void;onShare:()=>void;onReceipt:()=>void;onExport:()=>void;onMissing:()=>void;
  onViewFile:(f:ClientFile)=>void;onSaveFile:(f:ClientFile)=>void;
  issue:{open:boolean;text:string;setText:(v:string)=>void;toggle:()=>void;send:()=>void};
};

type Props={
  lang:Lang;
  request:ClientRequest;
  onBack:()=>void;
  actions:DetailsActions;
  /** True while an action runs (buttons are disabled, one action at a time). */
  busy?:boolean;
  /** Outcome / error text from the last action. */
  message?:string;
  /** Invoice & payment panel (rendered by the caller with its own state). */
  financePanel?:React.ReactNode;
  /** Full app sync (push local changes, then pull); used by pull-to-refresh. */
  onRefresh?:()=>Promise<void>|void;
  /** Receives the fresh server copy so the caller can store it. */
  onUpdated?:(r:ClientRequest)=>void;
};

type Sync={kind:'idle'}|{kind:'loading'}|{kind:'error';notFound:boolean};

export function TransactionDetailsScreen({lang,request,onBack,actions,busy=false,message,financePanel,onRefresh,onUpdated}:Props){
  const t=pick(COPY,lang),row=rowFor(lang);
  const reduce=useReduceTransparency();
  const [sync,setSync]=useState<Sync>({kind:'idle'});
  const [refreshing,setRefreshing]=useState(false);
  const [supportBusy,setSupportBusy]=useState(false);
  const [supportError,setSupportError]=useState(false);
  const mounted=useRef(true),supportLock=useRef(false),run=useRef(0);
  const latest=useRef(request);latest.current=request;
  const onUpdatedRef=useRef(onUpdated);onUpdatedRef.current=onUpdated;
  const r=request;
  const live=!!r.remoteId&&!r.sample&&apiEnabled&&hasSession();

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);

  /** Fresh server copy. Skipped while local changes wait to upload, so they are never overwritten. */
  const load=useCallback(async()=>{
    const cur=latest.current;
    if(!live||!cur.remoteId||needsSync(cur))return;
    const id=++run.current;
    setSync({kind:'loading'});
    try{
      const fresh=await fetchRequest(cur.remoteId,cur);
      if(!mounted.current||id!==run.current)return;
      if(!needsSync(latest.current))onUpdatedRef.current?.(fresh);
      setSync({kind:'idle'});
    }catch(e){
      if(!mounted.current||id!==run.current)return;
      // 401 is handled by the api client (refresh, then the session-expired handler).
      setSync({kind:'error',notFound:e instanceof ApiError&&e.status===404});
    }
  },[live]);

  useEffect(()=>{void load()},[r.remoteId,load]);

  const pull=async()=>{
    setRefreshing(true);
    try{if(onRefresh)await onRefresh();else await load()}finally{if(mounted.current)setRefreshing(false)}
  };

  async function contactSupport(){
    if(supportLock.current)return;
    supportLock.current=true;setSupportBusy(true);setSupportError(false);
    const ref=r.remoteId&&r.remoteId!==r.id?`${r.id} (${r.remoteId})`:r.id;
    try{
      // Opens WhatsApp with a prefilled message; nothing is sent automatically.
      try{await Linking.openURL(`${SUPPORT_WHATSAPP}?text=${encodeURIComponent(t.supportText(ref))}`)}
      catch{await Linking.openURL(SUPPORT_PHONE)}
    }catch{if(mounted.current)setSupportError(true)}
    finally{supportLock.current=false;if(mounted.current)setSupportBusy(false)}
  }

  const done=r.status==='completed';
  const hasFinal=r.files.some(f=>f.kind==='final');
  const deliverables=r.files.filter(f=>f.kind==='final'||f.kind==='invoice');
  const dates:[string,string|undefined][]=[
    [t.submitted,r.createdAt],
    r.completedAt?[t.completed,r.completedAt]:[t.expected,r.expectedAt],
    r.acknowledgedAt?[t.received,r.acknowledgedAt]:[t.delivered,r.deliveredAt],
  ];
  const moneyRows:[string,number|null][]=[
    [r.finance?t.govFeesAuthority:t.govFees,r.money.government],[t.companyFee,r.money.handling],
    [t.tax,r.money.taxConfigured===false?null:r.money.tax],[t.total,total(r)],[t.paid,r.money.paid],[t.due,remaining(r)],
  ];
  const events=r.events.slice(-5);

  return <GlassScreen refreshControl={live||onRefresh?<RefreshControl refreshing={refreshing} onRefresh={()=>void pull()} tintColor={colors.orange} colors={[colors.orange]}/>:undefined}>
        <ScreenHeader lang={lang} title={t.title} backLabel={t.back} onBack={onBack}/>

        {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}
        {sync.kind==='loading'&&<View accessible accessibilityLabel={t.refreshing} accessibilityState={{busy:true}} style={[styles.syncRow,{flexDirection:row}]}>
          <ActivityIndicator color={colors.orange}/>
          <Txt lang={lang} style={styles.syncText}>{t.refreshing}</Txt>
        </View>}
        {sync.kind==='error'&&<View style={[styles.syncRow,styles.syncError,{flexDirection:row}]}>
          <Icon name="info" size={20} color={colors.danger}/>
          <View style={g.flex1}><Txt lang={lang} style={{...styles.syncText,color:colors.danger}}>{sync.notFound?t.notFound:t.offline}</Txt></View>
          {!sync.notFound&&<GlassButton lang={lang} compact label={t.retry} onPress={()=>void load()}/>}
        </View>}

        {/* Summary */}
        <GlassCard reduce={reduce}>
          <View style={[styles.summaryTop,{flexDirection:row}]}>
            <View style={styles.documentIcon}><Icon name="file" size={26} color={colors.orange}/></View>
            <View style={[g.flex1,styles.summaryText]}>
              <Txt lang={lang} bold style={styles.transactionTitle}>{tr(r.title,lang)}</Txt>
              <Txt lang={lang} style={styles.reference}>{t.reference} {ltr('#'+r.id.replace('DEMO-',''))}</Txt>
            </View>
          </View>
          <View style={[styles.badges,{flexDirection:row}]}>
            <StatusBadge lang={lang} status={r.status}/>
            {r.sample&&<Tag lang={lang}>{t.sample}</Tag>}
          </View>
          <View style={[styles.dates,{flexDirection:row}]}>
            {dates.map(([label,v])=><View key={label} style={styles.dateCell}>
              <Txt lang={lang} style={styles.dateLabel}>{label}</Txt>
              <Txt lang={lang} bold style={styles.dateValue}>{dateText(v,lang)}</Txt>
            </View>)}
          </View>
        </GlassCard>

        {/* Where it stands / what is needed */}
        {r.whatNow&&<GlassCard reduce={reduce} tone={r.whatNow.actionRequired?'warning':'success'}>
          <View accessibilityRole="summary" style={styles.whatNow}>
            <Txt lang={lang} bold style={g.sectionTitle}>{r.whatNow.actionRequired?t.actionNeeded:t.whereAmI}</Txt>
            <Txt lang={lang} style={styles.body}>{tr(r.whatNow,lang)}</Txt>
          </View>
          {r.status==='needs_documents'&&<GlassButton lang={lang} primary icon="upload" label={t.completeDocs} disabled={busy} onPress={actions.onMissing}/>}
        </GlassCard>}
        {!r.whatNow&&r.status==='needs_documents'&&<GlassButton lang={lang} primary icon="upload" label={t.completeDocs} disabled={busy} onPress={actions.onMissing}/>}

        {/* Progress steps */}
        {!done&&<GlassCard reduce={reduce}><StageTracker lang={lang} stage={r.stage}/></GlassCard>}

        {/* Financial details */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.financial}</SectionTitle>
          <Note lang={lang}>{t.inAed}</Note>
          {r.money.quoted
            ?<View>{moneyRows.map(([label,v],i)=><ValueRow key={label} lang={lang} label={label} strong={i>=3} highlight={i===3}
                value={v===null?t.taxOff:amount(v)} last={i===moneyRows.length-1}/>)}</View>
            :<Txt lang={lang} style={styles.body}>{t.awaitingQuote}</Txt>}
          {r.sample&&<Note lang={lang} tone="warning">{t.illustrative}</Note>}
        </GlassCard>

        {/* Invoice & payment */}
        {financePanel}

        {/* Final documents */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.finalDocs}</SectionTitle>
          {deliverables.length>0&&<View>
            {deliverables.map((f,i)=><View key={f.id} style={[styles.fileRow,{flexDirection:row},i===deliverables.length-1&&g.noBorder]}>
              <Icon name={f.kind==='invoice'?'card':'file'} size={20} color={colors.orange}/>
              <View style={g.flex1}>
                <Txt lang={lang} bold style={styles.fileName} numberOfLines={2}>{tr(f.label,lang)}</Txt>
                <Txt lang={lang} style={styles.meta} numberOfLines={1}>{f.name}</Txt>
              </View>
              <IconButton icon="eye" label={`${t.view} ${tr(f.label,lang)}`} disabled={busy} onPress={()=>actions.onViewFile(f)}/>
              <IconButton icon="download" label={`${t.save} ${tr(f.label,lang)}`} disabled={busy} onPress={()=>actions.onSaveFile(f)}/>
            </View>)}
          </View>}
          {!hasFinal&&<Txt lang={lang} style={styles.body}>{t.noFinal}</Txt>}
          {r.files.length>0&&<GlassButton lang={lang} icon="folder" label={t.allFiles} disabled={busy} onPress={actions.onFiles}/>}
        </GlassCard>

        {/* Delivery: receipt confirmation and problem report */}
        {done&&<GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.delivery}</SectionTitle>
          <Note lang={lang} tone={r.acknowledgedAt?'success':'warning'}>{r.acknowledgedAt?t.receiptDone:t.receiptWaiting}</Note>
          <GlassButton lang={lang} primary icon="check" label={t.confirmReceipt} disabled={!!r.acknowledgedAt||!hasFinal} busy={busy&&!r.acknowledgedAt&&hasFinal} onPress={actions.onReceipt}/>
          <GlassButton lang={lang} icon={actions.issue.open?'close':'info'} label={actions.issue.open?t.closeReport:t.reportProblem} onPress={actions.issue.toggle}/>
          {actions.issue.open&&<View style={styles.issue}>
            <GlassField lang={lang} label={t.issueLabel} placeholder={t.issuePlaceholder} multiline value={actions.issue.text} onChangeText={actions.issue.setText}/>
            <GlassButton lang={lang} primary label={t.sendIssue} disabled={!actions.issue.text.trim()||busy} onPress={actions.issue.send}/>
          </View>}
          {!!r.issue&&!actions.issue.open&&<Note lang={lang}>{t.issueSent}</Note>}
        </GlassCard>}

        {/* History */}
        <GlassCard reduce={reduce}>
          <SectionTitle lang={lang}>{t.history}</SectionTitle>
          {events.length>0?<View>
            {events.map((ev,i)=>{const last=i===events.length-1;return <View key={ev.id} style={[styles.event,{flexDirection:row}]}>
              <View style={styles.eventRail}>
                <View style={[styles.eventDot,last&&styles.eventDotNow]}/>
                {!last&&<View style={styles.eventLine}/>}
              </View>
              <View style={[g.flex1,!last&&styles.eventGap]}>
                <Txt lang={lang} style={styles.body}>{tr(ev.text,lang)}</Txt>
                <Txt lang={lang} style={styles.meta}>{dateText(ev.at,lang)}</Txt>
              </View>
            </View>})}
          </View>:<Txt lang={lang} style={styles.body}>{t.noUpdates}</Txt>}
        </GlassCard>

        {/* Export / share */}
        <View style={[styles.actionsRow,{flexDirection:row}]}>
          <GlassButton lang={lang} fill icon="download" label={Platform.OS==='web'?t.exportWeb:t.exportNative} disabled={busy} onPress={actions.onExport}/>
          <GlassButton lang={lang} fill icon="arrows" label={t.share} disabled={busy} onPress={actions.onShare}/>
        </View>

        {/* Support */}
        <View style={styles.supportBlock}>
          <GlassButton lang={lang} icon="mail" accessibilityLabel={t.contactSupportA11y} label={supportBusy?t.opening:t.contactSupport} busy={supportBusy} onPress={()=>void contactSupport()}/>
          {supportError&&<View accessibilityLiveRegion="polite"><Txt lang={lang} style={styles.errorText}>{t.supportError}</Txt></View>}
        </View>
  </GlassScreen>;
}

const styles=StyleSheet.create({


  syncRow:{alignItems:'center',gap:space.sm,padding:space.md,borderRadius:radius.control,backgroundColor:colors.white},
  syncError:{backgroundColor:'#FBE6E3'},
  syncText:{fontSize:type.subhead,lineHeight:22,color:colors.muted},

  summaryTop:{alignItems:'center',gap:space.md},
  summaryText:{gap:2},
  documentIcon:{width:52,height:52,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint},
  transactionTitle:{fontSize:type.title2,lineHeight:32},
  reference:{fontSize:type.subhead,lineHeight:22,color:colors.muted},
  badges:{flexWrap:'wrap',gap:space.sm},
  dates:{borderTopWidth:layout.hairline,borderTopColor:colors.line,paddingTop:space.md,gap:space.sm},
  dateCell:{flex:1,gap:2},
  dateLabel:{fontSize:type.caption,lineHeight:18,color:colors.muted,textAlign:'center'},
  dateValue:{fontSize:type.footnote+1,lineHeight:20,textAlign:'center'},

  whatNow:{gap:space.xs},
  body:{fontSize:type.subhead,lineHeight:24,color:onGlass.soft},


  fileRow:{alignItems:'center',gap:space.sm+2,paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  fileName:{fontSize:type.subhead,lineHeight:22},
  meta:{fontSize:type.caption,lineHeight:18,color:colors.muted},

  issue:{gap:space.md},

  event:{gap:space.md},
  eventRail:{alignItems:'center',width:14},
  eventDot:{width:10,height:10,borderRadius:5,marginTop:9,backgroundColor:colors.line},
  eventDotNow:{backgroundColor:colors.orange},
  eventLine:{flex:1,width:2,backgroundColor:colors.line,marginVertical:space.xs},
  eventGap:{paddingBottom:space.lg},

  actionsRow:{gap:space.md,alignItems:'stretch'},
  supportBlock:{gap:space.sm+2},
  errorText:{fontSize:type.footnote+1,lineHeight:22,color:colors.danger,textAlign:'center'},
});
