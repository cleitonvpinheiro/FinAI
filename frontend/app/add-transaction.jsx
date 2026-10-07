import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { Button, Chip, ChipRow, F, Field, Icon, R, S, EXPENSE_CATS, INCOME_CATS, catMeta, useToast } from "@/src/ui";
import { colors } from "@/src/theme";

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("alimentacao");
  const [accountId, setAccountId] = useState(null);
  const [saving, setSaving] = useState(false);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api("/accounts") });
  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;

  const save = async () => {
    const value = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!(value > 0) || !description.trim()) return toast("Informe valor e descrição", "error");
    setSaving(true);
    try {
      await api("/transactions", {
        method: "POST",
        body: { type, amount: value, description: description.trim(), category, account_id: accountId },
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await qc.invalidateQueries();
      toast("Transação adicionada");
      router.back();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + S.md }]} testID="add-transaction-screen">
      <View style={styles.header}>
        <Pressable testID="add-transaction-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="close" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Nova transação</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xl }}
      >
        <View style={[styles.segment, { marginHorizontal: S.lg }]}>
          {[
            ["expense", "Saída"],
            ["income", "Entrada"],
          ].map(([k, l]) => (
            <Pressable
              key={k}
              testID={`tx-type-${k}`}
              onPress={() => {
                setType(k);
                setCategory(k === "expense" ? "alimentacao" : "salario");
              }}
              style={[styles.segBtn, type === k && { backgroundColor: k === "expense" ? colors.error : colors.success }]}
            >
              <Text style={[styles.segText, type === k && { color: k === "expense" ? colors.onError : colors.onSuccess }]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.currency}>R$</Text>
          <TextInput
            testID="tx-amount-input"
            style={styles.amount}
            placeholder="0,00"
            placeholderTextColor={colors.borderStrong}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>

        <View style={{ paddingHorizontal: S.lg }}>
          <Field testID="tx-description-input" label="Descrição" placeholder="Ex.: Mercado do mês" value={description} onChangeText={setDescription} />
        </View>

        <Text style={[styles.label, { paddingHorizontal: S.lg }]}>Categoria</Text>
        <ChipRow>
          {cats.map((c) => (
            <Chip key={c} testID={`tx-category-${c}`} label={catMeta(c).label} icon={catMeta(c).icon} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </ChipRow>

        {accounts.data?.length ? (
          <>
            <Text style={[styles.label, { paddingHorizontal: S.lg }]}>Conta (opcional)</Text>
            <ChipRow>
              <Chip testID="tx-account-none" label="Nenhuma" selected={!accountId} onPress={() => setAccountId(null)} />
              {accounts.data.map((a) => (
                <Chip key={a.account_id} testID={`tx-account-${a.institution_id}`} label={a.institution_name} selected={accountId === a.account_id} onPress={() => setAccountId(a.account_id)} />
              ))}
            </ChipRow>
          </>
        ) : null}

        <View style={{ paddingHorizontal: S.lg }}>
          <Button testID="save-transaction-button" title="Salvar transação" onPress={save} loading={saving} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.lg },
  headerTitle: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: R.md, padding: S.xs },
  segBtn: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  segText: { fontFamily: F.text, fontSize: 15, fontWeight: "700", color: colors.muted },
  amountBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm, paddingVertical: S.lg },
  currency: { fontFamily: F.display, fontSize: 28, fontWeight: "700", color: colors.muted },
  amount: { fontFamily: F.display, fontSize: 48, fontWeight: "700", color: colors.onSurface, minWidth: 140, textAlign: "center" },
  label: { fontFamily: F.text, fontSize: 13, color: colors.muted, fontWeight: "600" },
});
