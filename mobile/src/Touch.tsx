import React from 'react';
import {Platform, Pressable as RNPressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle} from 'react-native';

/**
 * Drop-in Pressable with platform-native touch feedback (brand look unchanged):
 *  - Android: Material ripple clipped to the control (android_ripple), no opacity change, and a 48dp-friendly touch area.
 *  - iOS / web: Apple-style highlight (the control dims while pressed).
 * Pass `rippleColor` for controls on dark fills. A caller-supplied android_ripple always wins.
 */
type Props=PressableProps&{rippleColor?:string};
const DEFAULT_SLOP=Platform.OS==='android'?4:0; // grows the touch area (not the layout) towards Android's 48dp guideline

export const Pressable=React.forwardRef<React.ElementRef<typeof RNPressable>,Props>(function Pressable({rippleColor,style,android_ripple,hitSlop,disabled,...rest},ref){
  const composed=(state:PressableStateCallbackType):StyleProp<ViewStyle>=>{
    const base=typeof style==='function'?style(state):style;
    return Platform.OS==='android'||!state.pressed||disabled?base:[base,{opacity:0.6}];
  };
  return <RNPressable
    ref={ref}
    {...rest}
    disabled={disabled}
    hitSlop={hitSlop??DEFAULT_SLOP}
    android_ripple={android_ripple??(Platform.OS==='android'&&!disabled?{color:rippleColor??'rgba(60,40,10,0.16)',foreground:true}:undefined)}
    style={composed}
  />;
});

/** Same ripple/highlight rules for places that need only the props (e.g. custom wrappers). */
export const nativeFeedback=(rippleColor='rgba(60,40,10,0.16)')=>Platform.OS==='android'?{android_ripple:{color:rippleColor,foreground:true}}:{};
