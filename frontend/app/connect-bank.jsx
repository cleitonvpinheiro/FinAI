import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { BankAvatar, Button, ErrorState, F, Icon, R, S, Sheet, Skeleton, useToast } from "@/src/ui";
import { colors } from "@/src/theme";

const SCOPES = [
  ["person-circle-outline", "Dados cadastrais"],
  ["wallet-outline", "Saldos das contas"],
  ["swap-horizontal-outline", "Transações dos últimos 12 meses"],
];

export default function ConnectBank() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [bank, setBank] = useState(null);
  const [step, setStep] = useState("consent"); // consent | connecting | done
  const q = useQuery({ queryKey: ["institutions"], queryFn: () => api("/openfinance/institutions") });

  const authorize = async () => {
    setStep("connecting");
    try {
      await new Promise((r) => setTimeout(r, 1400)); // simulated bank redirect
      await api("/openfinance/connect", { method: "POST", body: { institution_id: bank.id } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await qc.invalidateQueries();
      setStep("done");
    } catch (e) {
      toast(e.message, "error");
      setStep("consent");
    }
  };

  const close = () => {
    const wasDone = step === "done";
    setBank(null);
    setStep("consent");
    if (wasDone) router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + S.md }]} testID="connect-bank-screen">
      <View style={styles.header}>
        <Pressable testID="connect-bank-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="close" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Open Finance</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xl }}>
        <View style={styles.banner}>
          <Icon name="shield-checkmark" size={24} color={colors.brandPrimary} />
          <Text style={styles.bannerText}>
            Conexão segura regulada pelo Banco Central. Você escolhe o que compartilhar e pode revogar a qualquer momento.
          </Text>
        </View>
        <Text style={styles.section}>Escolha sua instituição</Text>
        {q.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} />)
        ) : q.isError ? (
          <ErrorState onRetry={q.refetch} />
        ) : (
          q.data.map((i) => (
            <Pressable
              key={i.id}
              testID={`institution-${i.id}`}
              disabled={i.connected}
              onPress={() => setBank(i)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <BankAvatar initials={i.initials} color={i.color} size={44} />
              <Text style={styles.rowTitle}>{i.name}</Text>
              {i.connected ? (
                <View style={styles.badge} testID={`institution-${i.id}-connected`}>
                  <Text style={styles.badgeText}>Conectado</Text>
                </View>
              ) : (
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              )}
            </Pressable>
          ))
        )}
        <Text style={styles.note}>Ambiente de demonstração: os dados bancários são simulados.</Text>
      </ScrollView>

      <Sheet visible={!!bank} onClose={close} title={bank ? `Conectar ${bank.name}` : ""} testID="consent-sheet">
        {step === "connecting" ? (
          <View style={styles.center} testID="connecting-state">
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.centerText}>Conectando com {bank?.name}...</Text>
          </View>
        ) : step === "done" ? (
          <View style={styles.center} testID="connected-state">
            <Icon name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.centerTitle}>Banco conectado!</Text>
            <Text style={styles.centerText}>Suas contas e transações já foram sincronizadas.</Text>
            <Button testID="connect-done-button" title="Concluir" onPress={close} style={{ alignSelf: "stretch" }} />
          </View>
        ) : (
          <>
            <Text style={styles.centerText}>O FinAI solicitará acesso aos seguintes dados:</Text>
            {SCOPES.map(([ic, l]) => (
              <View key={l} style={styles.scope}>
                <Icon name={ic} size={22} color={colors.brandSecondary} />
                <Text style={styles.scopeText}>{l}</Text>
              </View>
            ))}
            <Text style={styles.note}>Prazo do consentimento: 12 meses</Text>
            <Button testID="authorize-button" title="Autorizar e conectar" icon="lock-closed" onPress={authorize} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.lg },
  headerTitle: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", gap: S.md, padding: S.lg, borderRadius: R.lg, backgroundColor: colors.brandGlow, borderWidth: 1, borderColor: colors.brandTertiary },
  bannerText: { flex: 1, fontFamily: F.text, fontSize: 13, lineHeight: 19, color: colors.onBrandTertiary },
  section: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.md, padding: S.md, minHeight: 68,
    borderRadius: R.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  rowTitle: { flex: 1, fontFamily: F.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  badge: { paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.pill, backgroundColor: colors.brandTertiary },
  badgeText: { fontFamily: F.text, fontSize: 12, fontWeight: "700", color: colors.onBrandTertiary },
  note: { fontFamily: F.text, fontSize: 12, color: colors.muted, textAlign: "center" },
  center: { alignItems: "center", gap: S.md, paddingVertical: S.xl },
  centerTitle: { fontFamily: F.display, fontSize: 22, fontWeight: "700", color: colors.onSurface },
  centerText: { fontFamily: F.text, fontSize: 14, color: colors.onSurfaceTertiary, textAlign: "center" },
  scope: { flexDirection: "row", alignItems: "center", gap: S.md, padding: S.md, borderRadius: R.md, backgroundColor: colors.surfaceTertiary },
  scopeText: { fontFamily: F.text, fontSize: 15, fontWeight: "600", color: colors.onSurface },
});
