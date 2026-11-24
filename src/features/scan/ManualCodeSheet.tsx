import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { BottomSheet, Button, Text } from '@/components/ui';
import { normalizeBarcode } from '@/domain/barcode';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (barcode: string) => void;
}

/** Saisie du code-barres à la main (code abîmé, caméra indisponible). */
export function ManualCodeSheet({ visible, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const code = normalizeBarcode(value);
    if (!code) {
      setError('Ce code ne semble pas valide. Vérifie les chiffres sous le code-barres.');
      return;
    }
    setValue('');
    setError(null);
    onSubmit(code);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Text variant="title2">Saisir le code-barres</Text>
        <TextInput
          autoFocus
          value={value}
          onChangeText={(v) => {
            setValue(v);
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={14}
          placeholder="Ex. 3017620422003"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Code-barres"
          onSubmitEditing={submit}
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: error ? colors.urgent : colors.surface2 }]}
        />
        {error && <Text variant="label" tone="urgent">{error}</Text>}
        <Button label="Rechercher" onPress={submit} disabled={value.replace(/\D/g, '').length < 8} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: 'DMSans_500Medium', fontSize: 20, letterSpacing: 2, borderRadius: 14, borderWidth: 2, paddingHorizontal: 14, minHeight: 56 },
});
