/**
 * Share sheet — glass bottom sheet (replaces the legacy `ShareDesign`).
 * The customer picks what to share (summary, amounts, invoices, files), previews it, then chooses Email, WhatsApp or the
 * system share sheet. Nothing is sent by the app itself; ClientWorkspace runs `shareRequest` and reports the outcome.
 */
import React from 'react';
import {Modal,Platform,ScrollView,StyleSheet,View} from 'react-native';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Pressable} from '../Touch';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {ContactGlyph} from '../ReferenceUI';
import {Txt,type Lang} from '../ui/Txt';
import {CheckRow,GlassButton,GlassField,Note,g,ltr,rowFor,useReduceTransparency} from '../ui/Glass';
import {colors,layout,radius,space,type} from '../theme';
import {shareSummary,type ClientRequest} from '../clientModel';

type Channel='email'|'whatsapp'|'system';
const COPY={
  ar:{title:'مشاركة المعاملة',choose:'اختر المحتوى الذي تريد مشاركته',close:'إغلاق',summary:'ملخص المعاملة',amounts:'إظهار المبالغ المالية',
    amountsHint:'متاح عند تضمين الملخص',invoice:'الفاتورة والإيصالات',files:'الملفات',preview:'معاينة المشاركة',onlyFiles:'الملفات المحددة فقط',
    review:'راجع المحتوى قبل الإرسال',email:'بريدك الإلكتروني',via:'المشاركة عبر',emailCh:'البريد الإلكتروني',whatsapp:'واتساب',more:'المزيد',
    onlySelected:'تُشارك المستندات المحددة فقط',nothing:'اختر شيئاً واحداً على الأقل للمشاركة',continue:'متابعة المشاركة',recipient:'اختر المستلم في تطبيق المشاركة'},
  en:{title:'Share request',choose:'Choose the content to share',close:'Close',summary:'Request summary',amounts:'Include financial amounts',
    amountsHint:'Available when the summary is included',invoice:'Invoice and receipts',files:'Files',preview:'Sharing preview',onlyFiles:'Selected files only',
    review:'Review the content before sending',email:'Your email',via:'Share via',emailCh:'Email',whatsapp:'WhatsApp',more:'More',
    onlySelected:'Only selected documents are shared',nothing:'Choose at least one item to share',continue:'Continue sharing',recipient:'Choose the recipient in the sharing app'},
} as const;

type Props={
  lang:Lang;r:ClientRequest|undefined;visible:boolean;onClose:()=>void;
  summary:boolean;financial:boolean;selected:string[];invoiceSelected:boolean;
  toggleSummary:()=>void;toggleFinancial:()=>void;toggleFile:(id:string)=>void;onInvoice:()=>void;
  onShare:(c:Channel)=>void;email:string;setEmail:(v:string)=>void;busy:boolean;message?:string;
};

export function ShareSheet({lang,r,visible,onClose,summary,financial,selected,invoiceSelected,toggleSummary,toggleFinancial,toggleFile,onInvoice,onShare,email,setEmail,busy,message}:Props){
  const t=COPY[lang],row=rowFor(lang);
  const reduce=useReduceTransparency();
  const insets=useSafeAreaInsets();
  const nothing=!summary&&!selected.length;
  const off=busy||nothing;
  const files=r?.files.filter(f=>f.kind!=='invoice')??[];
  const channels:{id:Channel;label:string}[]=[{id:'email',label:t.emailCh},{id:'whatsapp',label:t.whatsapp},{id:'system',label:t.more}];

  return <Modal visible={visible&&!!r} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={StyleSheet.absoluteFill} rippleColor="transparent"/>
      <View style={[styles.sheet,{paddingBottom:Math.max(insets.bottom,space.lg)}]}>
        {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={70}
          experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
        <View style={[StyleSheet.absoluteFill,reduce?styles.opaque:styles.tint]} pointerEvents="none"/>
        {r&&<ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.handle}/>
          <View style={[styles.head,{flexDirection:row}]}>
            <View style={g.flex1} accessibilityRole="header">
              <Txt lang={lang} bold style={g.headerTitle}>{t.title}</Txt>
              <Txt lang={lang} style={g.headerSubtitle}>{t.choose}</Txt>
            </View>
            <ScalePressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={styles.close}>
              <Icon name="close" size={20} color={colors.ink}/>
            </ScalePressable>
          </View>
          <View style={styles.requestChip}><Txt lang={lang} bold style={{...g.valueText,textAlign:'center'}}>{r.title[lang]} • {ltr('#'+r.id.replace('DEMO-',''))}</Txt></View>

          {!!message&&<View accessibilityLiveRegion="polite"><Note lang={lang} tone="warning">{message}</Note></View>}

          <View style={styles.options}>
            <CheckRow lang={lang} label={t.summary} checked={summary} onPress={toggleSummary}/>
            <CheckRow lang={lang} label={t.amounts} checked={summary&&financial} disabled={!summary} onPress={toggleFinancial}/>
            {!summary&&<Txt lang={lang} style={g.meta}>{t.amountsHint}</Txt>}
            <CheckRow lang={lang} label={t.invoice} checked={invoiceSelected} onPress={onInvoice}/>
            {files.length>0&&<Txt lang={lang} bold style={styles.groupLabel}>{t.files}</Txt>}
            {files.map(f=><CheckRow key={f.id} lang={lang} label={f.label[lang]} checked={selected.includes(f.id)} onPress={()=>toggleFile(f.id)}/>)}
          </View>

          <View style={styles.preview}>
            <Txt lang={lang} bold style={styles.groupLabel}>{t.preview}</Txt>
            <Txt lang={lang} style={g.body}>{summary?shareSummary(r,lang,financial):t.onlyFiles}</Txt>
            <Txt lang={lang} style={g.meta}>{t.review}</Txt>
          </View>

          <GlassField lang={lang} label={t.email} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}/>

          <Txt lang={lang} bold style={styles.groupLabel}>{t.via}</Txt>
          <View style={[styles.channels,{flexDirection:row}]}>
            {channels.map(c=><ScalePressable key={c.id} accessibilityRole="button" accessibilityLabel={`${t.via} ${c.label}`} accessibilityState={{disabled:off}} disabled={off}
              onPress={()=>onShare(c.id)} style={[styles.channel,off&&g.disabled]}>
              {c.id==='whatsapp'?<ContactGlyph whatsapp size={30}/>:<Icon name={c.id==='email'?'mail':'arrows'} size={26} color={colors.brand}/>}
              <Txt lang={lang} bold style={styles.channelText}>{c.label}</Txt>
            </ScalePressable>)}
          </View>
          <Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{nothing?t.nothing:t.onlySelected}</Txt>
          <GlassButton lang={lang} primary icon="arrows" label={t.continue} busy={busy} disabled={nothing} onPress={()=>onShare('system')}/>
          <Txt lang={lang} style={{...g.meta,textAlign:'center'}}>{t.recipient}</Txt>
        </ScrollView>}
      </View>
    </View>
  </Modal>;
}

const styles=StyleSheet.create({
  overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(57,41,27,0.28)'},
  sheet:{maxHeight:'94%',width:'100%',maxWidth:600,alignSelf:'center',borderTopLeftRadius:radius.card+10,borderTopRightRadius:radius.card+10,overflow:'hidden',
    borderWidth:1,borderBottomWidth:0,borderColor:'rgba(255,255,255,0.8)'},
  tint:{backgroundColor:Platform.select({ios:'rgba(255,249,244,0.62)',default:'rgba(255,249,244,0.94)'})},
  opaque:{backgroundColor:colors.white},
  body:{paddingHorizontal:space.xl,paddingTop:space.sm,gap:space.md},
  handle:{width:40,height:5,borderRadius:3,backgroundColor:'#C2AF9A',alignSelf:'center',marginBottom:space.xs},
  head:{alignItems:'center',gap:space.md},
  close:{width:layout.minTouch,height:layout.minTouch,borderRadius:radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.8)',overflow:'hidden'},
  requestChip:{padding:space.md,borderRadius:radius.control,backgroundColor:colors.brandTint},
  options:{gap:space.sm},
  groupLabel:{fontSize:type.footnote+1,lineHeight:20,color:colors.brand,marginTop:space.xs},
  preview:{gap:space.xs,padding:space.md,borderRadius:radius.control,borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.7)'},
  channels:{gap:space.md},
  channel:{flex:1,minHeight:84,alignItems:'center',justifyContent:'center',gap:space.xs+2,padding:space.sm,borderRadius:radius.card-4,
    borderWidth:1,borderColor:colors.line,backgroundColor:'rgba(255,255,255,0.75)',overflow:'hidden'},
  channelText:{fontSize:type.footnote+1,lineHeight:20,textAlign:'center'},
});
