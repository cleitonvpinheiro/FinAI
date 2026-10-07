import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { api, streamInsight } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { Button, Chip, ChipRow, EmptyState, F, Icon, Markdown, R, S, Skeleton, shortDate, useToast } from "@/src/ui";
import { colors } from "@/src/theme";

const MODELS = [
  ["claude", "Claude Sonnet 4.5"],
  ["gpt", "GPT-5.2"],
  ["gemini", "Gemini 3 Flash"],
];
const QUICK = ["Onde posso economizar?", "Estou dentro do orçamento?", "Como bater minhas metas mais rápido?", "Quais gastos são recorrentes?"];

export default function Insights() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [model, setModel] = useState("claude");
  const [question, setQuestion] = useState("");
  const [live, setLive] = useState(null); // {question, content}
  const [busy, setBusy] = useState(false);
  const history = useQuery({ queryKey: ["insights"], queryFn: () => api("/insights") });

  const ask = async (q) => {
    if (busy) return;
    setBusy(true);
    setLive({ question: q || null, content: "" });
    setQuestion("");
    try {
      await streamInsight({ model, question: q || null }, (delta) =>
        setLive((l) => ({ ...l, content: l.content + delta })),
      );
      await qc.invalidateQueries({ queryKey: ["insights"] });
      setLive(null);
    } catch (e) {
      setLive(null);
      toast(e.message || "Falha ao conectar com a IA", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await api(`/insights/${id}`, { method: "DELETE" }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["insights"] });
  };

  return (
    <View style={styles.root} testID="insights-screen">
      <View style={[styles.header, { paddingTop: insets.top + S.md }]}>
        <View style={styles.titleRow}>
          <View style={styles.lumina}>
            <Icon name="sparkles" size={20} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Lumina</Text>
            <Text style={styles.subtitle}>Sua consultora financeira com IA</Text>
          </View>
        </View>
        <ChipRow>
          {MODELS.map(([k, l]) => (
            <Chip key={k} testID={`model-${k}`} label={l} icon="hardware-chip-outline" selected={model === k} onPress={() => setModel(k)} />
          ))}
        </ChipRow>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: bottomChrome + S.xl }}
      >
        <Button testID="generate-analysis-button" icon="analytics-outline" title="Gerar análise completa" onPress={() => ask(null)} loading={busy && !live?.question} disabled={busy} />

        <View style={styles.askBox}>
          <TextInput
            testID="ai-question-input"
            style={styles.askInput}
            placeholder="Pergunte algo sobre suas finanças..."
            placeholderTextColor={colors.muted}
            value={question}
            onChangeText={setQuestion}
            multiline
            editable={!busy}
          />
          <Pressable
            testID="ai-send-button"
            disabled={busy || !question.trim()}
            onPress={() => ask(question.trim())}
            style={[styles.send, (busy || !question.trim()) && { opacity: 0.4 }]}
          >
            <Icon name="arrow-up" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <View style={styles.quickWrap}>
          {QUICK.map((q, i) => (
            <Pressable key={q} testID={`quick-question-${i}`} disabled={busy} onPress={() => ask(q)} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}>
              <Text style={styles.quickText}>{q}</Text>
            </Pressable>
          ))}
        </View>

        {live ? (
          <LinearGradient testID="live-insight-card" colors={[colors.brandGlow, colors.surfaceSecondary]} style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="sparkles" size={16} color={colors.brandSecondary} />
              <Text style={styles.cardQ} numberOfLines={2}>{live.question || "Análise completa"}</Text>
            </View>
            {live.content ? (
              <Markdown text={live.content} testID="live-insight-text" />
            ) : (
              <View style={{ gap: S.sm }}>
                <Text style={styles.thinking}>Lumina está analisando seus dados...</Text>
                <Skeleton height={14} style={{ width: "90%", backgroundColor: colors.surfaceTertiary }} />
                <Skeleton height={14} style={{ width: "70%", backgroundColor: colors.surfaceTertiary }} />
              </View>
            )}
          </LinearGradient>
        ) : null}

        <Text style={styles.section}>Histórico</Text>
        {history.isLoading ? (
          <Skeleton height={140} />
        ) : history.data?.length ? (
          history.data.map((ins, i) => (
            <Animated.View key={ins.insight_id} entering={FadeInDown.delay(i * 50)}>
              <LinearGradient testID={`insight-card-${ins.insight_id}`} colors={[colors.brandGlow, colors.surfaceSecondary]} style={styles.card}>
                <View style={styles.cardHead}>
                  <Icon name="sparkles" size={16} color={colors.brandSecondary} />
                  <Text style={styles.cardQ} numberOfLines={2}>{ins.question || "Análise completa"}</Text>
                  <Pressable testID={`delete-insight-${ins.insight_id}`} onPress={() => remove(ins.insight_id)} hitSlop={12}>
                    <Icon name="trash-outline" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <Markdown text={ins.content} />
                <Text style={styles.meta}>{ins.model_label} · {shortDate(ins.created_at)}</Text>
              </LinearGradient>
            </Animated.View>
          ))
        ) : !live ? (
          <EmptyState
            testID="insights-empty"
            icon="sparkles-outline"
            title="Bem-vindo aos Insights"
            text="Gere uma análise ou faça uma pergunta. A IA usa seus saldos, transações, orçamentos e metas."
          />
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.lg },
  lumina: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.display, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  subtitle: { fontFamily: F.text, fontSize: 13, color: colors.muted },
  askBox: {
    flexDirection: "row", alignItems: "flex-end", gap: S.sm, padding: S.sm, paddingLeft: S.lg,
    borderRadius: R.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  askInput: { flex: 1, minHeight: 44, maxHeight: 120, color: colors.onSurface, fontFamily: F.text, fontSize: 15, paddingVertical: S.md },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  quick: { paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.pill, borderWidth: 1, borderColor: colors.brandTertiary, minHeight: 36, justifyContent: "center" },
  quickText: { fontFamily: F.text, fontSize: 13, color: colors.onBrandTertiary, fontWeight: "600" },
  card: { padding: S.lg, gap: S.md, borderRadius: R.lg, borderWidth: 1, borderColor: colors.brandTertiary },
  cardHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  cardQ: { flex: 1, fontFamily: F.display, fontSize: 15, fontWeight: "700", color: colors.brandSecondary },
  thinking: { fontFamily: F.text, fontSize: 14, color: colors.muted },
  meta: { fontFamily: F.text, fontSize: 12, color: colors.muted },
  section: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface, marginTop: S.sm },
});
