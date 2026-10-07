import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import {
  Button, CatIcon, Chip, EmptyState, ErrorState, F, Field, Icon, ProgressBar, R, S, Sheet, Skeleton,
  EXPENSE_CATS, brl, catMeta, useToast,
} from "@/src/ui";
import { colors } from "@/src/theme";

const parseAmount = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
const GOAL_ICONS = ["flag", "airplane", "car", "home", "school", "shield-checkmark", "gift", "laptop"];

function budgetColor(p) {
  if (p >= 1) return colors.error;
  if (p >= 0.8) return colors.warning;
  return colors.brandPrimary;
}

export default function Plans() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [tab, setTab] = useState("budgets");
  const [budgetSheet, setBudgetSheet] = useState(null); // {category, limit, budget_id?}
  const [goalSheet, setGoalSheet] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: "", target: "", deadline: "", icon: "flag" });
  const [contribGoal, setContribGoal] = useState(null);
  const [contribAmount, setContribAmount] = useState("");

  const budgets = useQuery({ queryKey: ["budgets"], queryFn: () => api("/budgets") });
  const goals = useQuery({ queryKey: ["goals"], queryFn: () => api("/goals") });
  const active = tab === "budgets" ? budgets : goals;

  const onDone = (msg) => {
    qc.invalidateQueries();
    toast(msg);
  };
  const onError = (e) => toast(e.message, "error");

  const saveBudget = useMutation({
    mutationFn: (b) => api("/budgets", { method: "POST", body: b }),
    onSuccess: () => {
      setBudgetSheet(null);
      onDone("Orçamento salvo");
    },
    onError,
  });
  const deleteBudget = useMutation({
    mutationFn: (id) => api(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setBudgetSheet(null);
      onDone("Orçamento removido");
    },
    onError,
  });
  const createGoal = useMutation({
    mutationFn: (g) => api("/goals", { method: "POST", body: g }),
    onSuccess: () => {
      setGoalSheet(false);
      setGoalForm({ name: "", target: "", deadline: "", icon: "flag" });
      onDone("Meta criada");
    },
    onError,
  });
  const contribute = useMutation({
    mutationFn: ({ id, amount }) => api(`/goals/${id}/contribute`, { method: "POST", body: { amount } }),
    onSuccess: (g) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setContribGoal(null);
      setContribAmount("");
      onDone(g.current >= g.target ? "Meta concluída! 🎉" : "Aporte registrado");
    },
    onError,
  });
  const deleteGoal = useMutation({
    mutationFn: (id) => api(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setContribGoal(null);
      onDone("Meta removida");
    },
    onError,
  });

  const submitBudget = () => {
    const limit = parseAmount(budgetSheet.limit);
    if (!budgetSheet.category || !(limit > 0)) return toast("Informe categoria e limite válido", "error");
    saveBudget.mutate({ category: budgetSheet.category, limit });
  };
  const submitGoal = () => {
    const target = parseAmount(goalForm.target);
    if (!goalForm.name.trim() || !(target > 0)) return toast("Informe nome e valor da meta", "error");
    createGoal.mutate({ name: goalForm.name, target, deadline: goalForm.deadline || null, icon: goalForm.icon });
  };
  const submitContribution = () => {
    const amount = parseAmount(contribAmount);
    if (!(amount > 0)) return toast("Informe um valor válido", "error");
    contribute.mutate({ id: contribGoal.goal_id, amount });
  };

  const totalLimit = (budgets.data || []).reduce((s, b) => s + b.limit, 0);
  const totalSpent = (budgets.data || []).reduce((s, b) => s + b.spent, 0);

  return (
    <View style={styles.root} testID="plans-screen">
      <View style={[styles.header, { paddingTop: insets.top + S.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Planos</Text>
          <Pressable
            testID={tab === "budgets" ? "new-budget-button" : "new-goal-button"}
            onPress={() => (tab === "budgets" ? setBudgetSheet({ category: "", limit: "" }) : setGoalSheet(true))}
            style={styles.addBtn}
          >
            <Icon name="add" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        <View style={styles.segment}>
          {[
            ["budgets", "Orçamentos"],
            ["goals", "Metas"],
          ].map(([k, l]) => (
            <Pressable key={k} testID={`plans-tab-${k}`} onPress={() => setTab(k)} style={[styles.segBtn, tab === k && styles.segActive]}>
              <Text style={[styles.segText, tab === k && { color: colors.onSurface }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: bottomChrome + S.xl }}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.brandPrimary} />}
      >
        {active.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={96} />)
        ) : active.isError ? (
          <ErrorState onRetry={active.refetch} />
        ) : tab === "budgets" ? (
          budgets.data.length === 0 ? (
            <EmptyState
              testID="budgets-empty"
              icon="pie-chart-outline"
              title="Crie seu primeiro orçamento"
              text="Defina limites mensais por categoria e acompanhe seus gastos."
              action="Novo orçamento"
              onAction={() => setBudgetSheet({ category: "", limit: "" })}
            />
          ) : (
            <>
              <View style={styles.summary} testID="budgets-summary">
                <Text style={styles.summaryLabel}>Gasto neste mês</Text>
                <Text style={styles.summaryValue}>
                  {brl(totalSpent)} <Text style={styles.summaryOf}>de {brl(totalLimit)}</Text>
                </Text>
                <ProgressBar value={totalSpent / (totalLimit || 1)} color={budgetColor(totalSpent / (totalLimit || 1))} height={10} />
              </View>
              {budgets.data.map((b, i) => {
                const p = b.spent / b.limit;
                return (
                  <Animated.View key={b.budget_id} entering={FadeInDown.delay(i * 60)}>
                    <Pressable
                      testID={`budget-card-${b.category}`}
                      onPress={() => setBudgetSheet({ category: b.category, limit: String(b.limit).replace(".", ","), budget_id: b.budget_id })}
                      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
                    >
                      <View style={styles.cardTop}>
                        <CatIcon category={b.category} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{catMeta(b.category).label}</Text>
                          <Text style={styles.cardSub}>
                            {p >= 1 ? `Excedido em ${brl(b.spent - b.limit)}` : `Restam ${brl(b.limit - b.spent)}`}
                          </Text>
                        </View>
                        <Text style={[styles.pct, { color: budgetColor(p) }]}>{Math.round(p * 100)}%</Text>
                      </View>
                      <ProgressBar value={p} color={budgetColor(p)} />
                      <Text style={styles.cardMeta}>{brl(b.spent)} de {brl(b.limit)}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          )
        ) : goals.data.length === 0 ? (
          <EmptyState
            testID="goals-empty"
            icon="flag-outline"
            title="Crie sua primeira meta"
            text="Viagem, reserva de emergência, carro novo... guarde dinheiro com propósito."
            action="Nova meta"
            onAction={() => setGoalSheet(true)}
          />
        ) : (
          goals.data.map((g, i) => {
            const p = g.current / g.target;
            return (
              <Animated.View key={g.goal_id} entering={FadeInDown.delay(i * 60)}>
                <Pressable testID={`goal-card-${g.goal_id}`} onPress={() => setContribGoal(g)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.goalIcon}>
                      <Icon name={g.icon} size={20} color={colors.onBrandTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{g.name}</Text>
                      <Text style={styles.cardSub}>{g.deadline ? `Até ${g.deadline}` : "Sem prazo definido"}</Text>
                    </View>
                    <View style={[styles.ring, { borderColor: p >= 1 ? colors.success : colors.brandPrimary }]}>
                      <Text style={styles.ringText}>{Math.min(100, Math.round(p * 100))}%</Text>
                    </View>
                  </View>
                  <ProgressBar value={p} color={p >= 1 ? colors.success : colors.brandPrimary} />
                  <Text style={styles.cardMeta}>{brl(g.current)} de {brl(g.target)}</Text>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Sheet visible={!!budgetSheet} onClose={() => setBudgetSheet(null)} title={budgetSheet?.budget_id ? "Editar orçamento" : "Novo orçamento"} testID="budget-sheet">
        {budgetSheet ? (
          <>
            <Text style={styles.label}>Categoria</Text>
            <View style={styles.wrap}>
              {EXPENSE_CATS.map((c) => (
                <Chip
                  key={c}
                  testID={`budget-category-${c}`}
                  label={catMeta(c).label}
                  icon={catMeta(c).icon}
                  selected={budgetSheet.category === c}
                  onPress={() => !budgetSheet.budget_id && setBudgetSheet({ ...budgetSheet, category: c })}
                />
              ))}
            </View>
            <Field
              testID="budget-limit-input"
              label="Limite mensal (R$)"
              placeholder="0,00"
              keyboardType="decimal-pad"
              value={budgetSheet.limit}
              onChangeText={(v) => setBudgetSheet({ ...budgetSheet, limit: v })}
            />
            <Button testID="save-budget-button" title="Salvar orçamento" onPress={submitBudget} loading={saveBudget.isPending} />
            {budgetSheet.budget_id ? (
              <Button testID="delete-budget-button" variant="danger" title="Remover orçamento" onPress={() => deleteBudget.mutate(budgetSheet.budget_id)} loading={deleteBudget.isPending} />
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={goalSheet} onClose={() => setGoalSheet(false)} title="Nova meta" testID="goal-sheet">
        <Field testID="goal-name-input" label="Nome da meta" placeholder="Ex.: Viagem para o Japão" value={goalForm.name} onChangeText={(v) => setGoalForm({ ...goalForm, name: v })} />
        <Field testID="goal-target-input" label="Valor alvo (R$)" placeholder="0,00" keyboardType="decimal-pad" value={goalForm.target} onChangeText={(v) => setGoalForm({ ...goalForm, target: v })} />
        <Field testID="goal-deadline-input" label="Prazo (opcional)" placeholder="Ex.: 12/2026" value={goalForm.deadline} onChangeText={(v) => setGoalForm({ ...goalForm, deadline: v })} />
        <Text style={styles.label}>Ícone</Text>
        <View style={styles.wrap}>
          {GOAL_ICONS.map((ic) => (
            <Pressable
              key={ic}
              testID={`goal-icon-${ic}`}
              onPress={() => setGoalForm({ ...goalForm, icon: ic })}
              style={[styles.iconPick, goalForm.icon === ic && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
            >
              <Icon name={ic} size={20} color={goalForm.icon === ic ? colors.onBrandTertiary : colors.muted} />
            </Pressable>
          ))}
        </View>
        <Button testID="save-goal-button" title="Criar meta" onPress={submitGoal} loading={createGoal.isPending} />
      </Sheet>

      <Sheet visible={!!contribGoal} onClose={() => setContribGoal(null)} title={contribGoal?.name || ""} testID="contribute-sheet">
        {contribGoal ? (
          <>
            <Text style={styles.cardSub}>
              Guardado {brl(contribGoal.current)} de {brl(contribGoal.target)}
            </Text>
            <Field testID="contribute-amount-input" label="Valor do aporte (R$)" placeholder="0,00" keyboardType="decimal-pad" value={contribAmount} onChangeText={setContribAmount} />
            <Button testID="contribute-button" title="Adicionar aporte" icon="add-circle-outline" onPress={submitContribution} loading={contribute.isPending} />
            <Button testID="delete-goal-button" variant="danger" title="Excluir meta" onPress={() => deleteGoal.mutate(contribGoal.goal_id)} loading={deleteGoal.isPending} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.surface, paddingHorizontal: S.lg, paddingBottom: S.md, gap: S.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: F.display, fontSize: 26, fontWeight: "700", color: colors.onSurface },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: R.md, padding: S.xs },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  segActive: { backgroundColor: colors.surfaceTertiary },
  segText: { fontFamily: F.text, fontSize: 14, fontWeight: "700", color: colors.muted },
  summary: { padding: S.lg, gap: S.sm, borderRadius: R.lg, backgroundColor: colors.brandGlow, borderWidth: 1, borderColor: colors.brandTertiary },
  summaryLabel: { fontFamily: F.text, fontSize: 13, color: colors.onBrandTertiary },
  summaryValue: { fontFamily: F.display, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  summaryOf: { fontFamily: F.text, fontSize: 14, color: colors.muted, fontWeight: "400" },
  card: { padding: S.lg, gap: S.md, borderRadius: R.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  cardTitle: { fontFamily: F.text, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  cardSub: { fontFamily: F.text, fontSize: 13, color: colors.muted, marginTop: 2 },
  cardMeta: { fontFamily: F.text, fontSize: 12, color: colors.onSurfaceTertiary },
  pct: { fontFamily: F.display, fontSize: 18, fontWeight: "700" },
  goalIcon: { width: 40, height: 40, borderRadius: R.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  ring: { width: 52, height: 52, borderRadius: 26, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  ringText: { fontFamily: F.display, fontSize: 13, fontWeight: "700", color: colors.onSurface },
  label: { fontFamily: F.text, fontSize: 13, color: colors.muted, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  iconPick: {
    width: 48, height: 48, borderRadius: R.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
});
