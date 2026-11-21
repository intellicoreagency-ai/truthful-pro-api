import React,{useMemo,useState} from 'react';
import {Modal,Platform,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {Pressable} from '../Touch';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {GoldBadge,LuxCard,ScalePressable} from '../ui/Premium';
import {useReduceTransparency} from '../ui/Glass';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {COMMON} from '../i18n';
import {colors,layout,lux,onGlass,radius,space,type} from '../theme';

export type SheetItem={id:string;title:string;subtitle?:string};
export type SheetSection={title?:string;items:SheetItem[]};
type Lang=import('../i18n').Lang;

/**
 * Apple-style bottom sheet picker: grabber, title, optional search, grouped rows with a check on the selected one.
 * Closes with the close button, a tap outside, or the Android system back button (Modal onRequestClose).
 */
export function SelectSheet({visible,lang,title,sections,selectedId,searchPlaceholder,onSelect,onClose}:{visible:boolean;lang:Lang;title:string;sections:SheetSection[];selectedId?:string|null;searchPlaceholder?:string;onSelect:(id:string)=>void;onClose:()=>void}){
  const ar=lang==='ar';
  const reduce=useReduceTransparency();
  const [q,setQ]=useState('');
  const filtered=useMemo(()=>{
    const n=q.trim().toLowerCase();
    return sections.map(s=>({...s,items:s.items.filter(i=>!n||`${i.title} ${i.subtitle??''}`.toLowerCase().includes(n))})).filter(s=>s.items.length);
  },[sections,q]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={s.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel={COMMON[lang].close} onPress={onClose} style={s.dismiss}><View/></Pressable>
      <View style={s.sheet} accessibilityViewIsModal>
        {/* glass material: blur + ivory sheen; gold hairline along the top edge */}
        {!reduce&&<BlurView pointerEvents="none" tint="light" intensity={70} experimentalBlurMethod={Platform.OS==='android'?'dimezisBlurView':undefined} style={StyleSheet.absoluteFill}/>}
        <LinearGradient pointerEvents="none" colors={reduce?[lux.ivory,lux.ivory]:['rgba(243,245,248,0.9)','rgba(243,245,248,0.97)']} style={StyleSheet.absoluteFill}/>
        <LinearGradient pointerEvents="none" colors={['rgba(217,188,126,0)','rgba(217,188,126,0.85)','rgba(217,188,126,0)']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.topLine}/>
        <View style={s.grabber}/>
        <View style={[s.head,{flexDirection:ar?'row-reverse':'row'}]}>
          <Txt lang={lang} style={s.title}>{title}</Txt>
          <ScalePressable accessibilityRole="button" accessibilityLabel={COMMON[lang].close} onPress={onClose} style={s.close}><View pointerEvents="none"><Icon name="close" size={18} color={colors.ink}/></View></ScalePressable>
        </View>
        {searchPlaceholder?<View style={[s.search,{flexDirection:ar?'row-reverse':'row'}]}>
          <Icon name="search" size={18} color={onGlass.soft}/>
          <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={searchPlaceholder} placeholder={searchPlaceholder} placeholderTextColor={onGlass.placeholder}
            value={q} onChangeText={setQ} style={[s.searchInput,ar?{fontFamily:'CairoRegular',textAlign:'right',writingDirection:'rtl'}:{textAlign:'left'}]}/>
        </View>:null}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {filtered.map((sec,si)=><View key={si} style={s.section}>
            {sec.title?<Txt lang={lang} style={s.sectionTitle}>{sec.title}</Txt>:null}
            <LuxCard reduce={reduce} radius={radius.card}>
              {sec.items.map((it,i)=>{const on=it.id===selectedId;return <ScalePressable key={it.id} accessibilityRole="radio" accessibilityState={{selected:on,checked:on}} aria-checked={on} accessibilityLabel={it.title} onPress={()=>{onSelect(it.id);setQ('');}}
                style={[s.row,{flexDirection:ar?'row-reverse':'row'},i<sec.items.length-1&&s.rowLine,on&&s.rowOn]}>
                <View style={s.rowText}><Txt lang={lang} style={{...s.rowTitle,...(on?{color:colors.brand}:null)}}>{it.title}</Txt>{it.subtitle?<Txt lang={lang} style={s.rowSub} numberOfLines={2}>{it.subtitle}</Txt>:null}</View>
                {on?<GoldBadge icon="check" size={30}/>:null}
              </ScalePressable>;})}
            </LuxCard>
          </View>)}
          {!filtered.length?<Txt lang={lang} style={s.none}>{COMMON[lang].noResults}</Txt>:null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const s=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(10,20,48,0.38)'},
  dismiss:{flex:1},
  sheet:{maxHeight:'82%',width:'100%',maxWidth:600,alignSelf:'center',overflow:'hidden',backgroundColor:lux.ivory,borderTopLeftRadius:30,borderTopRightRadius:30,paddingTop:space.sm,...Platform.select({web:{boxShadow:'0 -8px 30px rgba(0,0,0,0.2)'} as object,default:{elevation:16}})},
  topLine:{position:'absolute',top:0,left:0,right:0,height:1.5},
  grabber:{alignSelf:'center',width:40,height:5,borderRadius:3,backgroundColor:'rgba(184,137,63,0.55)',marginBottom:space.sm},
  head:{alignItems:'center',justifyContent:'space-between',paddingHorizontal:space.lg,paddingBottom:space.sm},
  title:{fontSize:type.title2,fontWeight:'700',color:'#0E1526'},
  close:{width:layout.minTouch,height:layout.minTouch,borderRadius:layout.minTouch/2,backgroundColor:'rgba(255,255,255,0.9)',borderWidth:1,borderColor:'rgba(217,188,126,0.55)',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  search:{marginHorizontal:space.lg,marginBottom:space.sm,minHeight:48,alignItems:'center',gap:space.sm,paddingHorizontal:space.md,borderRadius:16,backgroundColor:'rgba(255,255,255,0.7)',borderWidth:1,borderColor:'rgba(217,188,126,0.55)'},
  searchInput:{flex:1,minWidth:0,minHeight:layout.minTouch-4,fontSize:type.callout,color:colors.ink},
  list:{paddingHorizontal:space.lg,paddingBottom:space.xxl*1.5,gap:space.lg},
  section:{gap:space.sm},sectionTitle:{fontSize:type.subhead,fontWeight:'700',color:colors.brand,paddingHorizontal:space.xs},
  row:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+8,paddingHorizontal:space.lg,paddingVertical:space.sm},
  rowLine:{borderBottomWidth:1,borderColor:'rgba(217,188,126,0.28)'},
  rowOn:{backgroundColor:'rgba(232,237,251,0.55)'},
  rowText:{flex:1,gap:2},rowTitle:{fontSize:type.body,fontWeight:'600'},rowSub:{fontSize:type.footnote,color:colors.muted},
  none:{textAlign:'center',color:colors.muted,paddingVertical:space.xxl},
});
