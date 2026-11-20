import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Pressable} from './Touch';
import {Icon} from './Icons';
import {COMPANY, LEGAL_VERSION, type LegalDoc} from './legal';

type Language='ar'|'en';
type Props={lang:Language;doc:LegalDoc;onBack:()=>void;Text:React.ComponentType<{lang:Language;children:React.ReactNode;style?:object}>};

export function LegalScreen({lang,doc,onBack,Text:T}:Props){
 const ar=lang==='ar';
 return <View style={s.root}>
  <View style={[s.bar,{flexDirection:ar?'row-reverse':'row'}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={ar?'رجوع':'Back'} onPress={onBack} style={s.back} hitSlop={8}>
    <Icon name={ar?'next':'back'} size={22} color="#3C281B"/>
   </Pressable>
   <T lang={lang} style={s.barTitle}>{doc.title[lang]}</T>
   <View style={s.back}/>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
   <View style={s.draft}><T lang={lang} style={s.draftText}>{ar?'مسودة بانتظار المراجعة القانونية':'Draft pending legal review'}</T></View>
   <T lang={lang} style={[s.meta,{textAlign:ar?'right':'left'}]}>{COMPANY.name[lang]} · {COMPANY.city[lang]} · {LEGAL_VERSION}</T>
   <T lang={lang} style={[s.p,{textAlign:ar?'right':'left'}]}>{doc.intro[lang]}</T>
   {doc.sections.map((x,i)=><View key={i} style={s.card}>
    <T lang={lang} style={[s.h,{textAlign:ar?'right':'left'}]}>{x.h[lang]}</T>
    <T lang={lang} style={[s.p,{textAlign:ar?'right':'left'}]}>{x.p[lang]}</T>
   </View>)}
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FFF8EE'},
 bar:{alignItems:'center',justifyContent:'space-between',paddingHorizontal:8,minHeight:56,borderBottomWidth:1,borderBottomColor:'#EAD9BF'},
 back:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 barTitle:{fontSize:17,fontWeight:'900',color:'#3C281B'},
 body:{padding:16,gap:12,paddingBottom:40},
 draft:{alignSelf:'center',backgroundColor:'#FFE9C7',borderRadius:999,paddingHorizontal:12,paddingVertical:5,borderWidth:1,borderColor:'#F0B35A'},
 draftText:{fontSize:11,fontWeight:'800',color:'#7A4A00'},
 meta:{fontSize:11,color:'#8A7355'},
 card:{backgroundColor:'#FFFDF8',borderRadius:14,borderWidth:1,borderColor:'#EAD9BF',padding:14,gap:6},
 h:{fontSize:15,fontWeight:'900',color:'#3C281B'},
 p:{fontSize:13.5,lineHeight:23,color:'#5A4430'},
});
