/**
 * Request files — glass redesign of the files layer in ClientWorkspace.
 * Every file of the request, grouped: delivered files, invoices, and the documents the customer sent.
 */
import React from 'react';
import {StyleSheet,View} from 'react-native';
import {Icon,type IconName} from '../Icons';
import {Txt,type Lang} from '../ui/Txt';
import {GlassCard,GlassScreen,IconButton,Note,ScreenHeader,SectionTitle,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,radius,space,type} from '../theme';
import {dateText,type ClientFile,type ClientRequest} from '../clientModel';
import {pick,tr} from '../i18n';

const COPY={
  ar:{title:'ملفات المعاملة',back:'رجوع إلى تفاصيل المعاملة',final:'الملفات النهائية',invoice:'الفواتير والإيصالات',source:'مستنداتك المرسلة',
    empty:'لا ملفات متاحة بعد',inReview:'قيد المراجعة اليدوية',reviewed:'تمت المراجعة',reviewNote:'يراجع موظف مختص كل مستند يدوياً للتأكد أنه المستند المطلوب، وأنه واضح ومكتمل. إن احتجنا بديلاً سنخبرك هنا.',view:'معاينة',save:'تنزيل',pending:'بانتظار الرفع'},
  en:{title:'Request files',back:'Back to request details',final:'Final files',invoice:'Invoices and receipts',source:'Documents you sent',
    empty:'No files available yet',inReview:'Under manual review',reviewed:'Reviewed',reviewNote:'A specialist checks every document by hand to confirm it is the one requested and that it is clear and complete. If we need a replacement, we will tell you here.',view:'View',save:'Save',pending:'Waiting to upload'},
  ru:{inReview:'На ручной проверке',reviewed:'Проверено',reviewNote:'Специалист вручную проверяет каждый документ: тот ли это документ, чёткий ли он и полный ли. Если понадобится замена, мы сообщим здесь.',title:'Файлы заявки',back:'К деталям заявки',final:'Итоговые файлы',invoice:'Счета и квитанции',source:'Отправленные вами документы',empty:'Файлов пока нет',view:'Открыть',save:'Сохранить',pending:'Ожидает загрузки'},
  zh:{inReview:'人工审核中',reviewed:'已审核',reviewNote:'专员会人工核对每份文件，确认是所需文件且清晰完整。如需替换，我们会在此通知您。',title:'申请文件',back:'返回申请详情',final:'最终文件',invoice:'发票与收据',source:'您发送的文件',empty:'暂无文件',view:'查看',save:'保存',pending:'等待上传'},
  fr:{inReview:'En vérification manuelle',reviewed:'Vérifié',reviewNote:'Un spécialiste vérifie chaque document à la main : bon document, lisible et complet. Si un remplacement est nécessaire, nous vous le dirons ici.',title:'Fichiers de la demande',back:'Retour aux détails',final:'Fichiers finaux',invoice:'Factures et reçus',source:'Documents envoyés',empty:'Aucun fichier pour l’instant',view:'Voir',save:'Enregistrer',pending:'En attente d’envoi'},
  es:{inReview:'En revisión manual',reviewed:'Revisado',reviewNote:'Un especialista revisa cada documento a mano para confirmar que es el solicitado y que está claro y completo. Si necesitamos otro, se lo indicaremos aquí.',title:'Archivos de la solicitud',back:'Volver a los detalles',final:'Archivos finales',invoice:'Facturas y recibos',source:'Documentos enviados',empty:'Aún no hay archivos',view:'Ver',save:'Guardar',pending:'Pendiente de subir'},
} as const;

const GROUPS:{kind:ClientFile['kind'];icon:IconName}[]=[{kind:'final',icon:'check'},{kind:'invoice',icon:'card'},{kind:'source',icon:'file'}];
const size=(bytes:number)=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;
const ext=(name:string)=>(name.split('.').pop()??'').toUpperCase();
/** Manual review (no OCR): the customer's documents are checked by staff while the request is with us, then marked reviewed. */
const REVIEWING:ReadonlySet<ClientRequest['status']>=new Set(['submitted','review','needs_documents']);
const REVIEWED:ReadonlySet<ClientRequest['status']>=new Set(['ready_for_authority','authority','decision','completed']);

type Props={lang:Lang;r:ClientRequest;onBack:()=>void;onView:(f:ClientFile)=>void;onSave:(f:ClientFile)=>void;busy:boolean;message?:string};

export function RequestFilesScreen({lang,r,onBack,onView,onSave,busy,message}:Props){
  const t=pick(COPY,lang),row=rowFor(lang);
  const reduce=useReduceTransparency();
  return <GlassScreen>
    <ScreenHeader lang={lang} title={t.title} subtitle={tr(r.title,lang)} backLabel={t.back} onBack={onBack}/>
    {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}
    {r.files.length===0&&<GlassCard reduce={reduce}>
      <View style={styles.empty}><Icon name="folder" size={36} color={colors.muted}/><Txt lang={lang} style={{...g.body,textAlign:'center'}}>{t.empty}</Txt></View>
    </GlassCard>}
    {GROUPS.map(({kind,icon})=>{
      const files=r.files.filter(f=>f.kind===kind);
      if(!files.length)return null;
      return <GlassCard key={kind} reduce={reduce}>
        <SectionTitle lang={lang}>{t[kind]}</SectionTitle>
        {kind==='source'&&<Txt lang={lang} style={g.meta}>{t.reviewNote}</Txt>}
        <View>
          {files.map((f,i)=><View key={f.id} style={[styles.row,{flexDirection:row},i===files.length-1&&g.noBorder]}>
            <View style={styles.fileIcon}><Icon name={icon} size={20} color={colors.brand}/></View>
            <View style={g.flex1}>
              <Txt lang={lang} bold style={styles.name} numberOfLines={2}>{tr(f.label,lang)}</Txt>
              <Txt lang={lang} style={g.meta} numberOfLines={1}>{ltr(`${ext(f.name)} · ${size(f.size)}`)} · {kind==='source'&&!f.remoteId&&r.remoteId?t.pending:dateText(f.createdAt,lang)}</Txt>
              {kind==='source'&&f.remoteId&&(REVIEWING.has(r.status)||REVIEWED.has(r.status))?<View style={[styles.badge,REVIEWED.has(r.status)&&styles.badgeDone,{alignSelf:row==='row-reverse'?'flex-end':'flex-start'}]}><Txt lang={lang} bold style={styles.badgeText}>{REVIEWED.has(r.status)?t.reviewed:t.inReview}</Txt></View>:null}
            </View>
            <IconButton icon="eye" label={`${t.view} ${tr(f.label,lang)}`} disabled={busy} onPress={()=>onView(f)}/>
            <IconButton icon="download" label={`${t.save} ${tr(f.label,lang)}`} disabled={busy} onPress={()=>onSave(f)}/>
          </View>)}
        </View>
      </GlassCard>;
    })}
  </GlassScreen>;
}

const styles=StyleSheet.create({
  empty:{alignItems:'center',gap:space.sm,paddingVertical:space.lg},
  row:{alignItems:'center',gap:space.sm+2,paddingVertical:space.sm+2,borderBottomWidth:layout.hairline,borderBottomColor:colors.line},
  fileIcon:{width:40,height:40,borderRadius:radius.control,alignItems:'center',justifyContent:'center',backgroundColor:colors.brandTint},
  name:{fontSize:type.subhead,lineHeight:22},
  badge:{marginTop:4,paddingHorizontal:8,paddingVertical:2,borderRadius:radius.pill,backgroundColor:'rgba(217,188,126,0.25)'},
  badgeDone:{backgroundColor:'rgba(29,58,158,0.12)'},
  badgeText:{fontSize:12,lineHeight:16,color:colors.ink},
});
