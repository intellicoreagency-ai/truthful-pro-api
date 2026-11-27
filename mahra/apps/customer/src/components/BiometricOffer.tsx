import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { AUTH_LIVE } from '@/lib/authConfig';
import { biometricAvailable, declineOffer, enableBiometric, isBiometricEnabled, wasOfferDeclined } from '@/lib/biometric';
import { color, space } from '@/theme/tokens';

/**
 * بعد أول تسجيل دخول ناجح بجلسة حقيقية (رمز تحديث من الخادم): يعرض «تفعيل الدخول بالبصمة».
 * عند الموافقة وإن كان الجهاز يدعمها، يُحفظ الاعتماد في التخزين الآمن محمياً بالبصمة/الوجه.
 * لا يظهر قبل تفعيل الطريقة (AUTH_LIVE) ولا إن رفض العميل أو فعّلها سابقاً.
 */
export function BiometricOffer() {
  const { t } = useI18n();
  const { refreshToken, method } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!AUTH_LIVE.biometric || !refreshToken || method === 'biometric') return;
    let alive = true;
    (async () => {
      const [avail, enabled, declined] = await Promise.all([biometricAvailable(), isBiometricEnabled(), wasOfferDeclined()]);
      if (alive && avail && !enabled && !declined) setOpen(true);
    })();
    return () => { alive = false; };
  }, [refreshToken, method]);

  const enable = async () => {
    if (refreshToken) await enableBiometric(refreshToken);
    setOpen(false);
  };
  const later = async () => {
    await declineOffer();
    setOpen(false);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={later}>
      <View style={styles.scrim}>
        <Glass card style={styles.card}>
          <Ionicons name="finger-print-outline" size={40} color={color.goldBright} style={{ alignSelf: 'center' }} />
          <Text font="display" weight="bold" center style={{ fontSize: 20, lineHeight: 30, color: '#FFFFFF' }}>{t('bioOfferTitle')}</Text>
          <Text center tone="dim">{t('bioOfferBody')}</Text>
          <Button kind="cta" label={t('bioEnable')} onPress={enable} />
          <Button kind="glass" label={t('bioLater')} onPress={later} />
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(5,11,24,0.72)', justifyContent: 'center', padding: space.lg },
  card: { padding: space.lg, gap: space.md },
});
