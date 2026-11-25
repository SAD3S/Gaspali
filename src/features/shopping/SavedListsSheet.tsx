import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Pencil, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  Card,
  Field,
  Text,
  useSnackbar,
} from "@/components/ui";
import type { ShoppingRow } from "@/db/schema";
import {
  applySavedList,
  deleteSavedList,
  saveList,
  savedListsQuery,
  updateSavedList,
} from "@/db/shoppingRepo";
import { normalizeText } from "@/domain/inventory";
import {
  parseSavedItems,
  savedListPreview,
  toSavedItems,
} from "@/domain/savedLists";
import { useTheme } from "@/theme/ThemeProvider";
import { MIN_TOUCH } from "@/theme/tokens";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Liste en cours (pour « Enregistrer cette liste »). */
  current: ShoppingRow[];
}

/** Listes enregistrées : « Apéro », « Courses de base »… à réutiliser en un geste. */
export function SavedListsSheet({ visible, onClose, current }: Props) {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { data } = useLiveQuery(savedListsQuery());
  const lists = useMemo(
    () => (data ?? []).map((l) => ({ ...l, parsed: parseSavedItems(l.items) })),
    [data],
  );
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );

  const taken = lists.find(
    (l) => normalizeText(l.name) === normalizeText(name),
  );
  const save = () => {
    const items = toSavedItems(current);
    const doSave = () => {
      saveList(name, items);
      snackbar.show(
        `Liste « ${name.trim()} » enregistrée (${items.length} article${items.length > 1 ? "s" : ""})`,
      );
      setName("");
    };
    if (taken) {
      Alert.alert(
        `Remplacer « ${taken.name} » ?`,
        "Son contenu sera remplacé par la liste actuelle.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Remplacer", onPress: doSave },
        ],
      );
    } else doSave();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView
        style={{ maxHeight: 560 }}
        contentContainerStyle={{ gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title2">Mes listes</Text>

        {current.length > 0 && (
          <Card style={{ gap: 10 }}>
            <Text variant="bodyStrong">Enregistrer la liste actuelle</Text>
            <Text variant="label" tone="secondary">
              {savedListPreview(toSavedItems(current))}
            </Text>
            <Field
              label="Nom de la liste"
              value={name}
              onChangeText={setName}
              placeholder="Apéro, courses de base…"
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => name.trim() && save()}
            />
            <Button
              label={taken ? `Remplacer « ${taken.name} »` : "Enregistrer"}
              disabled={!name.trim()}
              onPress={save}
            />
          </Card>
        )}

        {lists.length === 0 ? (
          <Text variant="body" tone="secondary">
            {current.length
              ? "Donne un nom à ta liste pour la retrouver la prochaine fois."
              : "Pas encore de liste enregistrée : remplis ta liste de courses puis enregistre-la ici."}
          </Text>
        ) : (
          lists.map((l) => (
            <Card key={l.id} style={{ gap: 8 }}>
              {renaming?.id === l.id ? (
                <View style={{ gap: 8 }}>
                  <Field
                    label="Nouveau nom"
                    value={renaming.name}
                    onChangeText={(t) => setRenaming({ id: l.id, name: t })}
                    maxLength={40}
                    autoFocus
                  />
                  <View style={styles.row}>
                    <Button
                      label="Annuler"
                      variant="outline"
                      onPress={() => setRenaming(null)}
                      style={styles.flex}
                    />
                    <Button
                      label="Renommer"
                      disabled={!renaming.name.trim()}
                      onPress={() => {
                        updateSavedList(l.id, { name: renaming.name });
                        setRenaming(null);
                      }}
                      style={styles.flex}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{l.name}</Text>
                    <Text variant="label" tone="secondary" numberOfLines={2}>
                      {savedListPreview(l.parsed)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Renommer ${l.name}`}
                    onPress={() => setRenaming({ id: l.id, name: l.name })}
                    style={styles.icon}
                  >
                    <Pencil size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer ${l.name}`}
                    onPress={() =>
                      Alert.alert(
                        `Supprimer « ${l.name} » ?`,
                        "La liste de courses en cours n’est pas touchée.",
                        [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Supprimer",
                            style: "destructive",
                            onPress: () => deleteSavedList(l.id),
                          },
                        ],
                      )
                    }
                    style={styles.icon}
                  >
                    <Trash2 size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}
              <Button
                label={`Ajouter à mes courses (${l.parsed.length})`}
                variant="soft"
                disabled={!l.parsed.length}
                onPress={() => {
                  const added = applySavedList(l.parsed);
                  snackbar.show(
                    added
                      ? `${added} article${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} depuis « ${l.name} »`
                      : "Tout y était déjà",
                  );
                  onClose();
                }}
              />
              {current.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert(
                      `Mettre à jour « ${l.name} » ?`,
                      "Elle contiendra exactement la liste actuelle.",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Mettre à jour",
                          onPress: () => {
                            updateSavedList(l.id, {
                              items: toSavedItems(current),
                            });
                            snackbar.show(`« ${l.name} » mise à jour`);
                          },
                        },
                      ],
                    )
                  }
                  style={styles.link}
                >
                  <Text variant="label" tone="primary">
                    Remplacer par la liste actuelle
                  </Text>
                </Pressable>
              )}
            </Card>
          ))
        )}
        <Button label="Fermer" variant="outline" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  icon: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  link: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
});
