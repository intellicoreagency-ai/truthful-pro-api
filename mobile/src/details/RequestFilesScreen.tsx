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

const COPY={
  ar:{title:'ملفات المعاملة',back:'رجوع إلى تفاصيل المعاملة',final:'الملفات النهائية',invoice:'الفواتير والإيصالات',source:'مستنداتك المرسلة',
    empty:'لا ملفات متاحة بعد',view:'معاينة',save:'تنزيل',pending:'بانتظار الرفع'},
  en:{title:'Request files',back:'Back to request details',final:'Final files',invoice:'Invoices and receipts',source:'Documents you sent',
    empty:'No files available yet',view:'View',save:'Save',pending:'Waiting to upload'},
} as const;

const GROUPS:{kind:ClientFile['kind'];icon:IconName}[]=[{kind:'final',icon:'check'},{kind:'invoice',icon:'card'},{kind:'source',icon:'file'}];
const size=(bytes:number)=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;
const ext=(name:string)=>(name.split('.').pop()??'').toUpperCase();

type Props={lang:Lang;r:ClientRequest;onBack:()=>void;onView:(f:ClientFile)=>void;onSave:(f:ClientFile)=>void;busy:boolean;message?:string};

export function RequestFilesScreen({lang,r,onBack,onView,onSave,busy,message}:Props){
  const t=COPY[lang],row=rowFor(lang);
  const reduce=useReduceTransparency();
  return <GlassScreen>
    <ScreenHeader lang={lang} title={t.title} subtitle={r.title[lang]} backLabel={t.back} onBack={onBack}/>
    {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}
    {r.files.length===0&&<GlassCard reduce={reduce}>
      <View style={styles.empty}><Icon name="folder" size={36} color={colors.muted}/><Txt lang={lang} style={{...g.body,textAlign:'center'}}>{t.empty}</Txt></View>
    </GlassCard>}
    {GROUPS.map(({kind,icon})=>{
      const files=r.files.filter(f=>f.kind===kind);
      if(!files.length)return null;
      return <GlassCard key={kind} reduce={reduce}>
        <SectionTitle lang={lang}>{t[kind]}</SectionTitle>
        <View>
          {files.map((f,i)=><View key={f.id} style={[styles.row,{flexDirection:row},i===files.length-1&&g.noBorder]}>
            <View style={styles.fileIcon}><Icon name={icon} size={20} color={colors.brand}/></View>
            <View style={g.flex1}>
              <Txt lang={lang} bold style={styles.name} numberOfLines={2}>{f.label[lang]}</Txt>
              <Txt lang={lang} style={g.meta} numberOfLines={1}>{ltr(`${ext(f.name)} · ${size(f.size)}`)} · {kind==='source'&&!f.remoteId&&r.remoteId?t.pending:dateText(f.createdAt,lang)}</Txt>
            </View>
            <IconButton icon="eye" label={`${t.view} ${f.label[lang]}`} disabled={busy} onPress={()=>onView(f)}/>
            <IconButton icon="download" label={`${t.save} ${f.label[lang]}`} disabled={busy} onPress={()=>onSave(f)}/>
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
});
