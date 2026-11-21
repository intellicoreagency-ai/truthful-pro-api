import React,{useMemo,useState} from 'react';
import {Modal,Platform,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {Pressable} from '../Touch';
import {ScalePressable} from '../ui/Premium';
import {Icon} from '../Icons';
import {Txt} from '../ui/Txt';
import {colors,layout,onGlass,radius,space,type} from '../theme';

export type SheetItem={id:string;title:string;subtitle?:string};
export type SheetSection={title?:string;items:SheetItem[]};
type Lang='ar'|'en';

/**
 * Apple-style bottom sheet picker: grabber, title, optional search, grouped rows with a check on the selected one.
 * Closes with the close button, a tap outside, or the Android system back button (Modal onRequestClose).
 */
export function SelectSheet({visible,lang,title,sections,selectedId,searchPlaceholder,onSelect,onClose}:{visible:boolean;lang:Lang;title:string;sections:SheetSection[];selectedId?:string|null;searchPlaceholder?:string;onSelect:(id:string)=>void;onClose:()=>void}){
  const ar=lang==='ar';
  const [q,setQ]=useState('');
  const filtered=useMemo(()=>{
    const n=q.trim().toLowerCase();
    return sections.map(s=>({...s,items:s.items.filter(i=>!n||`${i.title} ${i.subtitle??''}`.toLowerCase().includes(n))})).filter(s=>s.items.length);
  },[sections,q]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={s.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel={ar?'إغلاق':'Close'} onPress={onClose} style={s.dismiss}><View/></Pressable>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.grabber}/>
        <View style={[s.head,{flexDirection:ar?'row-reverse':'row'}]}>
          <Txt lang={lang} style={s.title}>{title}</Txt>
          <ScalePressable accessibilityRole="button" accessibilityLabel={ar?'إغلاق':'Close'} onPress={onClose} style={s.close}><Icon name="close" size={18} color={colors.ink}/></ScalePressable>
        </View>
        {searchPlaceholder?<View style={[s.search,{flexDirection:ar?'row-reverse':'row'}]}>
          <Icon name="search" size={18} color={onGlass.soft}/>
          <TextInput maxFontSizeMultiplier={layout.maxFontScale} underlineColorAndroid="transparent" accessibilityLabel={searchPlaceholder} placeholder={searchPlaceholder} placeholderTextColor={onGlass.placeholder}
            value={q} onChangeText={setQ} style={[s.searchInput,ar?{fontFamily:'CairoRegular',textAlign:'right',writingDirection:'rtl'}:{textAlign:'left'}]}/>
        </View>:null}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {filtered.map((sec,si)=><View key={si} style={s.section}>
            {sec.title?<Txt lang={lang} style={s.sectionTitle}>{sec.title}</Txt>:null}
            <View style={s.group}>
              {sec.items.map((it,i)=>{const on=it.id===selectedId;return <ScalePressable key={it.id} accessibilityRole="radio" accessibilityState={{selected:on}} accessibilityLabel={it.title} onPress={()=>{onSelect(it.id);setQ('');}}
                style={[s.row,{flexDirection:ar?'row-reverse':'row'},i<sec.items.length-1&&s.rowLine]}>
                <View style={s.rowText}><Txt lang={lang} style={[s.rowTitle,on&&{color:colors.brand}]}>{it.title}</Txt>{it.subtitle?<Txt lang={lang} style={s.rowSub} numberOfLines={2}>{it.subtitle}</Txt>:null}</View>
                {on?<Icon name="check" size={20} color={colors.brand}/>:null}
              </ScalePressable>;})}
            </View>
          </View>)}
          {!filtered.length?<Txt lang={lang} style={s.none}>{ar?'لا نتائج':'No results'}</Txt>:null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const s=StyleSheet.create({
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(20,12,5,0.38)'},
  dismiss:{flex:1},
  sheet:{maxHeight:'82%',backgroundColor:colors.background,borderTopLeftRadius:28,borderTopRightRadius:28,paddingTop:space.sm,...Platform.select({web:{boxShadow:'0 -8px 30px rgba(0,0,0,0.2)'} as object,default:{elevation:16}})},
  grabber:{alignSelf:'center',width:40,height:5,borderRadius:3,backgroundColor:'rgba(118,102,91,0.35)',marginBottom:space.sm},
  head:{alignItems:'center',justifyContent:'space-between',paddingHorizontal:space.lg,paddingBottom:space.sm},
  title:{fontSize:type.title2,fontWeight:'700'},
  close:{width:layout.minTouch-8,height:layout.minTouch-8,borderRadius:(layout.minTouch-8)/2,backgroundColor:'rgba(118,102,91,0.14)',alignItems:'center',justifyContent:'center'},
  search:{marginHorizontal:space.lg,marginBottom:space.sm,minHeight:40,alignItems:'center',gap:space.sm,paddingHorizontal:space.md,borderRadius:radius.control,backgroundColor:'rgba(118,102,91,0.12)'},
  searchInput:{flex:1,minWidth:0,minHeight:layout.minTouch-4,fontSize:type.callout,color:colors.ink},
  list:{paddingHorizontal:space.lg,paddingBottom:space.xxl*1.5,gap:space.lg},
  section:{gap:space.sm},sectionTitle:{fontSize:type.footnote,fontWeight:'700',color:colors.muted,paddingHorizontal:space.xs},
  group:{backgroundColor:colors.white,borderRadius:radius.card-6,borderWidth:layout.hairline,borderColor:colors.line,overflow:'hidden'},
  row:{alignItems:'center',gap:space.md,minHeight:layout.minTouch+8,paddingHorizontal:space.lg,paddingVertical:space.sm},
  rowLine:{borderBottomWidth:layout.hairline,borderColor:colors.line},
  rowText:{flex:1,gap:2},rowTitle:{fontSize:type.body,fontWeight:'600'},rowSub:{fontSize:type.footnote,color:colors.muted},
  none:{textAlign:'center',color:colors.muted,paddingVertical:space.xxl},
});
