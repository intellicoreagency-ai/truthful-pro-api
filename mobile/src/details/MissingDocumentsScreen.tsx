/**
 * Missing documents — glass redesign (replaces the legacy `MissingDesign`).
 * The team asked for extra or replacement documents; the customer attaches each one, then sends them together.
 * State and side effects stay in ClientWorkspace (pick → attach locally, send → status back to review, then sync).
 */
import React from 'react';
import {StyleSheet,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {GlassButton,GlassCard,GlassScreen,Note,ScreenHeader,SectionTitle,StageTracker,Tag,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,radius,space,type} from '../theme';
import {canSendMissing,type ClientRequest} from '../clientModel';
import {pick,tr} from '../i18n';

const COPY={
  ar:{title:'استكمال المستندات',back:'رجوع إلى تفاصيل المعاملة',reference:'رقم الطلب',sample:'طلب تجريبي',
    required:'مطلوب استكمال مستندات',requiredBody:'يرجى رفع المستندات التالية لاستكمال طلبك',fromYou:'المستندات المطلوبة منك',
    replaceTag:'إعادة رفع',missingTag:'مستند ناقص',attachedTag:'تم الإرفاق',staffNote:'ملاحظة الموظف',
    newFile:'الملف الجديد',previousFile:'الملف السابق',replace:'استبدال الملف',change:'تغيير الملف',
    upload:'اضغط لرفع الملف',uploadA11y:(d:string)=>`رفع ${d}`,replaceA11y:(d:string)=>`استبدال ${d}`,formats:'PDF أو JPG أو PNG • حتى ٥ ميغابايت',
    kept:'المستندات المقبولة سابقاً محفوظة ضمن طلبك',send:'إرسال المستندات للاستكمال',
    remaining:(n:number,of:number)=>`أرفقت ${n} من ${of}. أرفق كل المستندات المطلوبة للإرسال.`,
    reviewed:'تُراجع الملفات بعد إرسالها',none:'لا توجد مستندات مطلوبة حالياً.'},
  en:{title:'Complete documents',back:'Back to request details',reference:'Request',sample:'Sample request',
    required:'Additional documents required',requiredBody:'Upload these documents to complete your request',fromYou:'Documents required from you',
    replaceTag:'Replace',missingTag:'Missing',attachedTag:'Attached',staffNote:'Staff note',
    newFile:'New file',previousFile:'Previous file',replace:'Replace file',change:'Change file',
    upload:'Tap to upload a file',uploadA11y:(d:string)=>`Upload ${d}`,replaceA11y:(d:string)=>`Replace ${d}`,formats:'PDF, JPG or PNG • up to 5 MB',
    kept:'Previously accepted documents remain in your request',send:'Send additional documents',
    remaining:(n:number,of:number)=>`${n} of ${of} attached. Attach every requested document to send.`,
    reviewed:'Files are reviewed after submission',none:'No documents are requested right now.'},
  ru:{title:'Дополнить документы',back:'К деталям заявки',reference:'Заявка',sample:'Пример заявки',
    required:'Нужны дополнительные документы',requiredBody:'Загрузите эти документы, чтобы завершить заявку',fromYou:'Документы от вас',
    replaceTag:'Заменить',missingTag:'Нет',attachedTag:'Приложен',staffNote:'Комментарий сотрудника',
    newFile:'Новый файл',previousFile:'Прежний файл',replace:'Заменить файл',change:'Сменить файл',
    upload:'Нажмите, чтобы загрузить файл',uploadA11y:(d:string)=>`Загрузить: ${d}`,replaceA11y:(d:string)=>`Заменить: ${d}`,formats:'PDF, JPG или PNG • до 5 МБ',
    kept:'Ранее принятые документы остаются в заявке',send:'Отправить документы',
    remaining:(n:number,of:number)=>`Приложено ${n} из ${of}. Приложите все запрошенные документы.`,
    reviewed:'Файлы проверяются после отправки',none:'Сейчас документы не запрошены.'},
  zh:{title:'补充文件',back:'返回申请详情',reference:'申请',sample:'示例申请',
    required:'需要补充文件',requiredBody:'上传这些文件以完成您的申请',fromYou:'需要您提供的文件',
    replaceTag:'需替换',missingTag:'缺少',attachedTag:'已附加',staffNote:'工作人员备注',
    newFile:'新文件',previousFile:'原文件',replace:'替换文件',change:'更换文件',
    upload:'点击上传文件',uploadA11y:(d:string)=>`上传 ${d}`,replaceA11y:(d:string)=>`替换 ${d}`,formats:'PDF、JPG 或 PNG • 不超过 5 MB',
    kept:'已接受的文件仍保留在您的申请中',send:'发送补充文件',
    remaining:(n:number,of:number)=>`已附加 ${n}/${of}。请附加全部所需文件后发送。`,
    reviewed:'文件将在提交后审核',none:'目前没有需要补充的文件。'},
  fr:{title:'Compléter les documents',back:'Retour aux détails',reference:'Demande',sample:'Demande d’exemple',
    required:'Documents complémentaires requis',requiredBody:'Téléversez ces documents pour compléter votre demande',fromYou:'Documents attendus de votre part',
    replaceTag:'À remplacer',missingTag:'Manquant',attachedTag:'Joint',staffNote:'Note de l’équipe',
    newFile:'Nouveau fichier',previousFile:'Fichier précédent',replace:'Remplacer le fichier',change:'Changer de fichier',
    upload:'Touchez pour téléverser un fichier',uploadA11y:(d:string)=>`Téléverser ${d}`,replaceA11y:(d:string)=>`Remplacer ${d}`,formats:'PDF, JPG ou PNG • 5 Mo maximum',
    kept:'Les documents déjà acceptés restent dans votre demande',send:'Envoyer les documents',
    remaining:(n:number,of:number)=>`${n} sur ${of} joints. Joignez tous les documents demandés pour envoyer.`,
    reviewed:'Les fichiers sont vérifiés après l’envoi',none:'Aucun document n’est demandé pour le moment.'},
  es:{title:'Completar documentos',back:'Volver a los detalles',reference:'Solicitud',sample:'Solicitud de ejemplo',
    required:'Se necesitan documentos adicionales',requiredBody:'Suba estos documentos para completar su solicitud',fromYou:'Documentos que necesitamos de usted',
    replaceTag:'Reemplazar',missingTag:'Falta',attachedTag:'Adjunto',staffNote:'Nota del equipo',
    newFile:'Archivo nuevo',previousFile:'Archivo anterior',replace:'Reemplazar archivo',change:'Cambiar archivo',
    upload:'Toque para subir un archivo',uploadA11y:(d:string)=>`Subir ${d}`,replaceA11y:(d:string)=>`Reemplazar ${d}`,formats:'PDF, JPG o PNG • hasta 5 MB',
    kept:'Los documentos ya aceptados siguen en su solicitud',send:'Enviar documentos',
    remaining:(n:number,of:number)=>`${n} de ${of} adjuntos. Adjunte todos los documentos solicitados para enviar.`,
    reviewed:'Los archivos se revisan tras el envío',none:'Ahora no se solicita ningún documento.'},
} as const;

type Props={lang:Lang;r:ClientRequest;onBack:()=>void;onPick:(id:string)=>void;onSend:()=>void;busy:boolean;message?:string};

export function MissingDocumentsScreen({lang,r,onBack,onPick,onSend,busy,message}:Props){
  const t=pick(COPY,lang),row=rowFor(lang);
  const reduce=useReduceTransparency();
  const open=r.status==='needs_documents';
  const attached=r.missing.filter(d=>d.replacement&&r.files.some(f=>f.id===d.replacement)).length;
  const ready=canSendMissing(r);

  return <GlassScreen>
    <ScreenHeader lang={lang} title={t.title} subtitle={tr(r.title,lang)} backLabel={t.back} onBack={onBack}/>
    {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}

    <GlassCard reduce={reduce}>
      <View style={[styles.refRow,{flexDirection:row}]}>
        <Txt lang={lang} style={g.headerSubtitle}>{t.reference} {ltr('#'+r.id.replace('DEMO-',''))}</Txt>
        {r.sample&&<Tag lang={lang}>{t.sample}</Tag>}
      </View>
      <StageTracker lang={lang} stage={r.stage}/>
    </GlassCard>

    <GlassCard reduce={reduce} tone="warning">
      <View style={[styles.alert,{flexDirection:row}]}>
        <View style={styles.alertIcon}><Icon name="file" size={28} color="#76592A"/></View>
        <View style={g.flex1}>
          <Txt lang={lang} bold style={styles.alertTitle}>{t.required}</Txt>
          <Txt lang={lang} style={g.body}>{t.requiredBody}</Txt>
        </View>
      </View>
    </GlassCard>

    <SectionTitle lang={lang}>{t.fromYou}</SectionTitle>
    {r.missing.length===0&&<Note lang={lang}>{t.none}</Note>}
    {r.missing.map((d,i)=>{
      const replacement=r.files.find(f=>f.id===d.replacement),previous=r.files.find(f=>f.id===d.previous);
      const isReplace=!!d.previous||!!r.sample&&i===0;
      const label=tr(d.label,lang);
      return <GlassCard key={d.id} reduce={reduce}>
        <View style={[styles.docHead,{flexDirection:row}]}>
          <Icon name={replacement?'check':'file'} size={22} color={replacement?colors.brand:colors.orange}/>
          <View style={g.flex1}><Txt lang={lang} bold style={styles.docTitle}>{label}</Txt></View>
          <Tag lang={lang} tone={replacement?'brand':'warning'}>{replacement?t.attachedTag:isReplace?t.replaceTag:t.missingTag}</Tag>
        </View>
        {!!tr(d.note,lang)&&<View style={styles.staffNote}>
          <Txt lang={lang} bold style={styles.staffNoteLabel}>{t.staffNote}</Txt>
          <Txt lang={lang} style={g.body}>{tr(d.note,lang)}</Txt>
        </View>}
        {replacement||isReplace
          ?<View style={styles.slot}>
            <View style={[styles.fileChip,{flexDirection:row}]}>
              <Icon name="file" size={22} color={colors.brand}/>
              <View style={g.flex1}>
                <Txt lang="en" bold style={styles.fileName} numberOfLines={1}>{replacement?.name??previous?.name??(r.sample?'passport.jpg':'—')}</Txt>
                <Txt lang={lang} style={g.meta}>{replacement?t.newFile:t.previousFile}</Txt>
              </View>
            </View>
            <GlassButton lang={lang} icon="upload" label={replacement?t.change:t.replace} accessibilityLabel={t.replaceA11y(label)}
              disabled={busy||!open} onPress={()=>onPick(d.id)}/>
          </View>
          :<ScalePressable accessibilityRole="button" accessibilityLabel={t.uploadA11y(label)} accessibilityHint={t.formats}
            accessibilityState={{disabled:busy||!open}} disabled={busy||!open} onPress={()=>onPick(d.id)} style={[styles.drop,(busy||!open)&&g.disabled]}>
            <Icon name="upload" size={30} color={colors.orange}/>
            <Txt lang={lang} bold style={styles.dropTitle}>{t.upload}</Txt>
            <Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{t.formats}</Txt>
          </ScalePressable>}
      </GlassCard>;
    })}

    <View style={[styles.kept,{flexDirection:row}]}>
      <Icon name="shield" size={20} color={colors.brand}/>
      <View style={g.flex1}><Txt lang={lang} style={g.body}>{t.kept}</Txt></View>
    </View>

    <View style={styles.sendBlock}>
      {!ready&&r.missing.length>0&&<Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{t.remaining(attached,r.missing.length)}</Txt>}
      <GlassButton lang={lang} primary icon="check" label={t.send} busy={busy&&ready} disabled={busy||!open||!ready} onPress={onSend}/>
      <Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{t.reviewed}</Txt>
    </View>
  </GlassScreen>;
}

const styles=StyleSheet.create({
  refRow:{alignItems:'center',justifyContent:'space-between',gap:space.sm,flexWrap:'wrap'},
  alert:{alignItems:'center',gap:space.md},
  alertIcon:{width:52,height:52,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#F1E3C2'},
  alertTitle:{fontSize:type.headline,lineHeight:26,color:'#76592A'},
  docHead:{alignItems:'center',gap:space.sm+2},
  docTitle:{fontSize:type.callout,lineHeight:24},
  staffNote:{gap:2,padding:space.md,borderRadius:radius.control,backgroundColor:'#F4F0E6'},
  staffNoteLabel:{fontSize:type.footnote,lineHeight:20,color:colors.brand},
  slot:{gap:space.md},
  fileChip:{alignItems:'center',gap:space.md,padding:space.md,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.7)'},
  fileName:{fontSize:type.subhead,lineHeight:22},
  drop:{alignItems:'center',gap:space.xs,minHeight:layout.minTouch*2,padding:space.lg,borderRadius:radius.control,borderWidth:1.5,borderStyle:'dashed',
    borderColor:colors.orange,backgroundColor:'rgba(255,255,255,0.7)',overflow:'hidden'},
  dropTitle:{fontSize:type.callout,lineHeight:24,color:'#8A6A2F'},
  kept:{alignItems:'center',gap:space.sm,paddingHorizontal:space.xs},
  sendBlock:{gap:space.sm},
});
