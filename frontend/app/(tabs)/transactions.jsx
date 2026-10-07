import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import {
  Button, Chip, ChipRow, EmptyState, ErrorState, F, Icon, S, Sheet, Skeleton, TransactionRow,
  CATEGORIES, brl, catMeta, shortDate, useToast,
} from "@/src/ui";
import { colors } from "@/src/theme";

const TYPES = [
  ["", "Todas"],
  ["income", "Entradas"],
  ["expense", "Saídas"],
];

export default function Transactions() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(null);

  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (category) params.set("category", category);
  const q = useQuery({
    queryKey: ["transactions", type, category],
    queryFn: () => api(`/transactions?${params.toString()}`),
  });

  const del = useMutation({
    mutationFn: (id) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries();
      setSelected(null);
      toast("Transação excluída");
    },
    onError: (e) => toast(e.message, "error"),
  });

  return (
    <View style={styles.root} testID="transactions-screen">
      <View style={[styles.header, { paddingTop: insets.top + S.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Transações</Text>
          <View style={styles.segment}>
            {TYPES.map(([k, l]) => (
              <Pressable key={k || "all"} testID={`type-filter-${k || "all"}`} onPress={() => setType(k)} style={[styles.segBtn, type === k && styles.segActive]}>
                <Text style={[styles.segText, type === k && { color: colors.onSurface }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ChipRow>
          <Chip testID="category-filter-all" label="Todas" selected={!category} onPress={() => setCategory("")} />
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <Chip key={k} testID={`category-filter-${k}`} label={c.label} icon={c.icon} selected={category === k} onPress={() => setCategory(k)} />
          ))}
        </ChipRow>
      </View>

      {q.isLoading ? (
        <View style={{ padding: S.lg, gap: S.md }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
        </View>
      ) : q.isError ? (
        <View style={{ padding: S.lg }}><ErrorState onRetry={q.refetch} /></View>
      ) : (
        <FlatList
          testID="transactions-list"
          data={q.data}
          keyExtractor={(t) => t.transaction_id}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: bottomChrome + 96 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              testID="transactions-empty"
              icon="receipt-outline"
              title="Nenhuma transação encontrada"
              text="Conecte um banco ou adicione uma transação manualmente."
              action="Adicionar transação"
              onAction={() => router.push("/add-transaction")}
            />
          }
          renderItem={({ item }) => (
            <TransactionRow tx={item} testID={`tx-row-${item.transaction_id}`} onPress={() => setSelected(item)} />
          )}
        />
      )}

      <Pressable
        testID="transactions-add-fab"
        onPress={() => router.push("/add-transaction")}
        style={({ pressed }) => [styles.fab, { bottom: bottomChrome + 16, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Icon name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title="Detalhes" testID="tx-detail-sheet">
        {selected ? (
          <>
            <Text style={[styles.detailAmount, { color: selected.type === "income" ? colors.success : colors.onSurface }]}>
              {selected.type === "income" ? "+" : "-"}{brl(selected.amount)}
            </Text>
            {[
              ["Descrição", selected.description],
              ["Categoria", catMeta(selected.category).label],
              ["Origem", selected.source === "openfinance" ? `Open Finance · ${selected.institution}` : "Manual"],
              ["Data", shortDate(selected.date)],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailVal}>{v}</Text>
              </View>
            ))}
            <Button testID="delete-transaction-button" variant="danger" icon="trash-outline" title="Excluir transação" loading={del.isPending} onPress={() => del.mutate(selected.transaction_id)} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.lg, gap: S.sm },
  title: { fontFamily: F.display, fontSize: 26, fontWeight: "700", color: colors.onSurface },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 3 },
  segBtn: { paddingHorizontal: 10, height: 32, justifyContent: "center", borderRadius: 8 },
  segActive: { backgroundColor: colors.surfaceTertiary },
  segText: { fontFamily: F.text, fontSize: 12, fontWeight: "700", color: colors.muted },
  sep: { height: 1, backgroundColor: colors.divider },
  fab: {
    position: "absolute", right: S.lg, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  detailAmount: { fontFamily: F.display, fontSize: 32, fontWeight: "700" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: S.lg },
  detailKey: { fontFamily: F.text, fontSize: 14, color: colors.muted },
  detailVal: { flex: 1, textAlign: "right", fontFamily: F.text, fontSize: 14, fontWeight: "600", color: colors.onSurface },
});
