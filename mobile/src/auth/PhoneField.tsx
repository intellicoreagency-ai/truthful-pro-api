import React,{useMemo,useState} from 'react';
import {FlatList,Modal,StyleSheet,Text,TextInput,View} from 'react-native';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {AText,type AuthText} from './AuthKit';
import {COUNTRIES,countryName,flagOf,type Country} from './countries';
import {localPhone,splitInternational} from './phone';
import {authGlass,colors,layout,radius,space,type} from '../theme';
import type {Lang} from './copy';

const COPY:Record<Lang,{code:string;search:string;use:(c:string)=>string;close:string}>={
  ar:{code:'رمز الدولة',search:'ابحث باسم الدولة أو الرمز',use:c=>`استخدام الرمز ${c}`,close:'إغلاق'},
  en:{code:'Country code',search:'Search country or code',use:c=>`Use code ${c}`,close:'Close'},
  ru:{code:'Код страны',search:'Поиск страны или кода',use:c=>`Использовать код ${c}`,close:'Закрыть'},
  zh:{code:'国家/地区代码',search:'搜索国家或代码',use:c=>`使用代码 ${c}`,close:'关闭'},
  fr:{code:'Indicatif pays',search:'Rechercher un pays ou un indicatif',use:c=>`Utiliser l’indicatif ${c}`,close:'Fermer'},
  es:{code:'Código de país',search:'Buscar país o código',use:c=>`Usar el código ${c}`,close:'Cerrar'},
};

/**
 * Mobile number on the glass card: the country code first (flag + code, opens a searchable list; UAE by default), then the
 * number. Always laid out left to right, the way phone numbers are written. Pasting a full international number picks its
 * country by itself.
 */
export function PhoneField({lang,label,iso,dial,local,onChange,error,hint,editable=true}:{
  lang:Lang;Text?:AuthText;label:string;iso:string;dial:string;local:string;
  onChange:(v:{iso:string;dial:string;local:string})=>void;error?:string|null;hint?:string;editable?:boolean;
}){
  const t=COPY[lang],T=AText,ar=lang==='ar';
  const [open,setOpen]=useState(false);const [q,setQ]=useState('');const [focused,setFocused]=useState(false);
  const list=useMemo(()=>{
    const s=q.trim().toLowerCase().replace(/^\+/,'');
    if(!s)return COUNTRIES;
    return COUNTRIES.filter(c=>c.dial.startsWith(s)||c.en.toLowerCase().includes(s)||c.ar.includes(q.trim())||countryName(c,lang).toLowerCase().includes(s)||c.iso.toLowerCase()===s);
  },[q,lang]);
  const typedCode=/^\+?([1-9]\d{0,3})$/.exec(q.trim())?.[1];
  const pick=(c:{iso:string;dial:string})=>{onChange({iso:c.iso,dial:c.dial,local:localPhone(local,c.dial)});setOpen(false);setQ('');};
  const type_=(v:string)=>{
    const intl=splitInternational(v);
    if(intl){const c=COUNTRIES.find(x=>x.dial===intl.dial&&x.iso===iso)??COUNTRIES.find(x=>x.dial===intl.dial);onChange({iso:c?.iso??'',dial:intl.dial,local:intl.local});return;}
    onChange({iso,dial,local:localPhone(v,dial)});
  };
  return <View style={s.wrap}>
    <T lang={lang} style={[s.label,{textAlign:ar?'right':'left'}]}>{label}</T>
    <View style={[s.field,focused&&s.focus,!!error&&s.error]}>
      <ScalePressable accessibilityRole="button" accessibilityLabel={`${t.code}: +${dial}`} disabled={!editable} onPress={()=>setOpen(true)} style={s.code} rippleColor="rgba(255,255,255,0.2)">
        <Text style={s.flag} accessible={false}>{flagOf(iso)}</Text>
        <Text maxFontSizeMultiplier={layout.maxFontScale} style={s.codeText}>+{dial}</Text>
        <Icon name="next" size={14} color={authGlass.soft}/>
      </ScalePressable>
      <View style={s.line}/>
      <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={`${label} +${dial}`}
        value={local} onChangeText={type_} editable={editable} placeholder={dial==='971'?'5X XXX XXXX':''} placeholderTextColor={authGlass.placeholder}
        keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={20} selectionColor={authGlass.link}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={s.input}/>
    </View>
    {error?<T lang={lang} style={[s.errorText,{textAlign:ar?'right':'left'}]}>{error}</T>:hint?<T lang={lang} style={[s.hint,{textAlign:ar?'right':'left'}]}>{hint}</T>:null}

    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={[s.sheetHead,{flexDirection:ar?'row-reverse':'row'}]}>
            <T lang={lang} style={s.sheetTitle}>{t.code}</T>
            <ScalePressable accessibilityRole="button" accessibilityLabel={t.close} onPress={()=>setOpen(false)} style={s.close}><Icon name="close" size={20} color={colors.ink}/></ScalePressable>
          </View>
          <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" value={q} onChangeText={setQ} placeholder={t.search}
            accessibilityLabel={t.search} placeholderTextColor="rgba(14,21,38,0.45)" autoCorrect={false} style={[s.search,{textAlign:ar?'right':'left'}]}/>
          <FlatList data={list} keyExtractor={c=>c.iso} keyboardShouldPersistTaps="handled" initialNumToRender={20}
            ListHeaderComponent={typedCode&&!COUNTRIES.some(c=>c.dial===typedCode)?<Row label={t.use('+'+typedCode)} flag="🌐" code={'+'+typedCode} ar={ar} onPress={()=>pick({iso:'',dial:typedCode})}/>:undefined}
            renderItem={({item}:{item:Country})=><Row label={countryName(item,lang)} flag={flagOf(item.iso)} code={'+'+item.dial} ar={ar} selected={item.iso===iso} onPress={()=>pick(item)}/>}/>
        </View>
      </View>
    </Modal>
  </View>;
}

function Row({label,flag,code,ar,selected,onPress}:{label:string;flag:string;code:string;ar:boolean;selected?:boolean;onPress:()=>void}){
  return <ScalePressable accessibilityRole="button" accessibilityLabel={`${label} ${code}`} accessibilityState={{selected:!!selected}} onPress={onPress}
    style={[s.row,{flexDirection:ar?'row-reverse':'row'},selected&&s.rowOn]} rippleColor="rgba(29,58,158,0.12)">
    <Text style={s.rowFlag} accessible={false}>{flag}</Text>
    <Text maxFontSizeMultiplier={layout.maxFontScale} style={[s.rowName,{textAlign:ar?'right':'left',fontFamily:ar?'CairoRegular':undefined}]} numberOfLines={1}>{label}</Text>
    <Text maxFontSizeMultiplier={layout.maxFontScale} style={s.rowCode}>{code}</Text>
  </ScalePressable>;
}

const web={outlineStyle:'none',outlineWidth:0} as object;
const s=StyleSheet.create({
  wrap:{gap:space.sm-2},
  label:{fontSize:type.footnote,fontWeight:'600',color:authGlass.soft},
  // always left to right: country code first, then the number
  field:{flexDirection:'row',direction:'ltr',minHeight:52,alignItems:'center',borderRadius:radius.control+4,backgroundColor:authGlass.field,borderWidth:1,borderColor:authGlass.border,paddingHorizontal:space.sm} as object,
  focus:{borderColor:'#E8D3A2',borderWidth:2,backgroundColor:authGlass.fieldFocus},
  error:{borderColor:authGlass.error,borderWidth:2},
  code:{flexDirection:'row',alignItems:'center',gap:4,minHeight:layout.minTouch,paddingHorizontal:space.sm,borderRadius:12},
  flag:{fontSize:20},
  codeText:{fontSize:type.body,fontWeight:'600',color:authGlass.text},
  line:{width:1,height:24,backgroundColor:authGlass.border,marginHorizontal:space.xs},
  input:{flex:1,minWidth:0,minHeight:layout.minTouch,fontSize:type.body,color:authGlass.text,textAlign:'left',writingDirection:'ltr',paddingHorizontal:space.sm,...web} as object,
  errorText:{fontSize:type.footnote,color:authGlass.error,fontWeight:'600'},
  hint:{fontSize:type.footnote,lineHeight:type.footnote*1.5,color:authGlass.soft},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(8,14,28,0.45)'},
  sheet:{maxHeight:'80%',backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,paddingTop:space.md,paddingHorizontal:space.lg,paddingBottom:space.lg,gap:space.sm},
  sheetHead:{alignItems:'center',justifyContent:'space-between'},
  sheetTitle:{fontSize:type.headline,fontWeight:'700',color:colors.ink},
  close:{width:layout.minTouch,height:layout.minTouch,alignItems:'center',justifyContent:'center',borderRadius:22},
  search:{minHeight:layout.minTouch,borderRadius:12,borderWidth:1,borderColor:colors.line,paddingHorizontal:space.md,fontSize:type.callout,color:colors.ink,...web} as object,
  row:{alignItems:'center',gap:space.md,minHeight:52,paddingHorizontal:space.sm,borderRadius:12},
  rowOn:{backgroundColor:'rgba(29,58,158,0.08)'},
  rowFlag:{fontSize:22},
  rowName:{flex:1,fontSize:type.callout,color:colors.ink},
  rowCode:{fontSize:type.callout,fontWeight:'600',color:colors.muted,writingDirection:'ltr'},
});
