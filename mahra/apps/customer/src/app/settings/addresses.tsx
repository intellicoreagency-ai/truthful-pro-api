import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { SubPage } from '@/components/SubPage';
import { Text } from '@/components/Text';
import { useTx } from '@/i18n';
import { color, space } from '@/theme/tokens';

export default function Addresses() {
  const tx = useTx();
  const list = [
    { icon: 'home-outline' as const, name: tx('المنزل', 'Home'), place: tx('الخوانيج، دبي', 'Al Khawaneej, Dubai') },
    { icon: 'briefcase-outline' as const, name: tx('العمل', 'Work'), place: tx('المدينة الأكاديمية، الشارقة', 'University City, Sharjah') },
    { icon: 'business-outline' as const, name: tx('مكتب أبوظبي', 'Abu Dhabi office'), place: tx('الريم، أبوظبي', 'Al Reem, Abu Dhabi') },
  ];
  return (
    <SubPage title={tx('العناوين المحفوظة', 'Saved addresses')} sub={tx('لتصل الخدمة إلى المكان الصحيح بلا تكرار.', 'So service reaches the right place without repeating.')}>
      {list.map((a) => (
        <Glass key={a.name} r={22} style={styles.row}>
          <View style={styles.ico}><Ionicons name={a.icon} size={22} color={color.gold} /></View>
          <View style={{ flex: 1 }}><Text weight="semibold">{a.name}</Text><Text variant="caption" tone="dim">{a.place}</Text></View>
          <Ionicons name="ellipsis-horizontal" size={20} color={color.textDim} />
        </Glass>
      ))}
      <Button kind="gold" label={tx('إضافة عنوان', 'Add an address')} icon={<Ionicons name="add" size={22} color={color.deep} />} onPress={() => undefined} />
    </SubPage>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  ico: { width: 44, height: 44, borderRadius: 14, backgroundColor: color.gold + '22', borderWidth: 1, borderColor: color.gold + '66', alignItems: 'center', justifyContent: 'center' },
});
