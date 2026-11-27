import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Text';
import { useI18n } from '@/i18n';
import { fontFor } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

/** حقل مبلغ كبير. الإطار يتحول للأزرق عند التركيز (مؤشر تركيز واضح بدل إطار المتصفح الخشن). */
export function PriceInput({ value, onChange, placeholder, label, size = 44 }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; size?: number }) {
  const { lang } = useI18n();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.box, focus && { borderColor: color.sapphire, borderWidth: 2.5 }]}>
      <Text variant="heading" tone="dim">AED</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 5))}
        inputMode="numeric"
        placeholder={placeholder}
        placeholderTextColor="#B3BACB"
        accessibilityLabel={label}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.input, { fontFamily: fontFor(lang, 'bold'), fontSize: size }, { outlineStyle: 'none', outlineWidth: 0 } as object]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md, direction: 'ltr', borderWidth: 1.5, borderColor: '#B9C2D6', borderRadius: radius.md, paddingHorizontal: space.lg, backgroundColor: '#fff' },
  input: { flex: 1, minWidth: 0, color: color.text, paddingVertical: 6 },
});
