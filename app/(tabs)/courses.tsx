import { ShoppingCart } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export default function Courses() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Text variant="title1" accessibilityRole="header">Courses</Text>
      <View style={styles.empty}>
        <ShoppingCart size={40} color={colors.textSecondary} />
        <Text variant="bodyStrong">Ta liste est vide</Text>
        <Text variant="body" tone="secondary" style={styles.center}>
          Ajoute des articles ici ou depuis une recette. (Étape 8)
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, marginTop: 80 },
  center: { textAlign: 'center' },
});
