import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

type Voice = {
  state: VoiceState;
  /** يبدأ الاستماع إن كانت ساكنة، ويوقف إن كانت نشطة */
  toggle: () => void;
  stop: () => void;
};

const Ctx = createContext<Voice | null>(null);

/**
 * حالة الصوت (محاكاة). الربط الحقيقي بالتعرف على الكلام ثم النموذج ثم الصوت (Veda)
 * يأتي في مرحلة لاحقة؛ الواجهة هنا تعتمد على هذه الحالات الأربع فقط، فلا تتغير عند الربط.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoiceState>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clear();
    setState('idle');
  }, [clear]);

  const start = useCallback(() => {
    clear();
    setState('listening');
    timers.current.push(
      setTimeout(() => setState('thinking'), 3200),
      setTimeout(() => setState('speaking'), 4600),
      setTimeout(() => setState('idle'), 8200),
    );
  }, [clear]);

  const toggle = useCallback(() => {
    if (state === 'idle') start();
    else stop();
  }, [state, start, stop]);

  useEffect(() => clear, [clear]);

  const value = useMemo(() => ({ state, toggle, stop }), [state, toggle, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoice(): Voice {
  const v = useContext(Ctx);
  if (!v) throw new Error('useVoice must be used inside <VoiceProvider>');
  return v;
}

/** يحترم إعداد «تقليل الحركة» في النظام */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
