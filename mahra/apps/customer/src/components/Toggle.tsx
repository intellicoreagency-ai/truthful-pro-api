import { Switch } from 'react-native';
import { color } from '@/theme/tokens';

/** مفتاح بنمط Apple: أخضر النظام عند التفعيل. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: 'rgba(120,120,128,0.36)', true: color.green }} thumbColor="#fff" {...({ activeThumbColor: '#fff' } as object)} ios_backgroundColor="rgba(120,120,128,0.36)" />;
}
