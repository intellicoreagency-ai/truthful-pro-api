import React,{createContext,useContext,useMemo,useState} from 'react';
import {ScrollView as RNScrollView,type ScrollViewProps} from 'react-native';

/** Height of the (translucent) tab bar including accessory and safe-area inset: content scrolls underneath it and ends above it. */
const Ctx=createContext<{height:number;setHeight:(h:number)=>void}>({height:0,setHeight:()=>{}});
export const useTabBarHeight=()=>useContext(Ctx).height;
export const useSetTabBarHeight=()=>useContext(Ctx).setHeight;

export function TabBarLayoutProvider({children}:{children:React.ReactNode}){
  const [height,setHeight]=useState(0);
  const value=useMemo(()=>({height,setHeight}),[height]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

type Handle=React.ComponentRef<typeof RNScrollView>;
/** ScrollView that keeps its last item clear of the tab bar while still letting content pass beneath the blur. */
export const ScrollView=React.forwardRef<Handle,ScrollViewProps>(function ScrollView({contentContainerStyle,scrollIndicatorInsets,...rest},ref){
  const h=useTabBarHeight();
  return <RNScrollView ref={ref} {...rest}
    contentContainerStyle={[contentContainerStyle,h?{paddingBottom:h}:null]}
    scrollIndicatorInsets={{bottom:h,...scrollIndicatorInsets}}/>;
});
