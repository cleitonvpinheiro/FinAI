import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import {
  BankAvatar, Button, EmptyState, ErrorState, F, Icon, ProgressBar, R, S, SectionTitle, Sheet, Skeleton,
  TransactionRow, brl, catMeta, styles as ui,
} from "@/src/ui";
import { colors } from "@/src/theme";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [hidden, setHidden] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api("/dashboard") });
  const d = q.data;
  const money = (v) => (hidden ? "R$ ••••" : brl(v));
  const maxCat = d?.by_category?.[0]?.amount || 1;

  return (
    <View style={styles.root} testID="home-screen">
      <View style={[styles.header, { paddingTop: insets.top + S.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Olá,</Text>
          <Text style={styles.name} numberOfLines={1} testID="home-user-name">
            {user?.name?.split(" ")[0]}
          </Text>
        </View>
        <Pressable
          testID="household-pill"
          onPress={() => router.push("/household")}
          style={({ pressed }) => [styles.housePill, pressed && { opacity: 0.7 }]}
        >
          <Icon name={d?.household ? "home" : "people-outline"} size={16} color={colors.onBrandTertiary} />
          <Text style={styles.housePillText} numberOfLines={1}>{d?.household?.name || "Minha casa"}</Text>
        </Pressable>
        <Pressable testID="profile-button" onPress={() => setProfileOpen(true)} style={styles.avatar}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: bottomChrome + 96, gap: S.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? (
          <View style={{ gap: S.lg }}>
            <Skeleton height={180} />
            <Skeleton height={96} />
            <Skeleton height={200} />
          </View>
        ) : q.isError ? (
          <ErrorState onRetry={q.refetch} testID="home-error" />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(450)}>
              <LinearGradient colors={[colors.brandTertiary, colors.surfaceSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>Saldo total</Text>
                  <Pressable testID="toggle-balance-visibility" onPress={() => setHidden((h) => !h)} hitSlop={12}>
                    <Icon name={hidden ? "eye-off" : "eye"} size={20} color={colors.onBrandTertiary} />
                  </Pressable>
                </View>
                <Text style={styles.balance} testID="total-balance">{money(d.total_balance)}</Text>
                <View style={styles.flowRow}>
                  <View style={styles.flow}>
                    <Icon name="arrow-down-circle" size={20} color={colors.success} />
                    <View>
                      <Text style={styles.flowLabel}>Entradas do mês</Text>
                      <Text style={styles.flowValue} testID="month-income">{money(d.month_income)}</Text>
                    </View>
                  </View>
                  <View style={styles.flow}>
                    <Icon name="arrow-up-circle" size={20} color={colors.error} />
                    <View>
                      <Text style={styles.flowLabel}>Saídas do mês</Text>
                      <Text style={styles.flowValue} testID="month-expense">{money(d.month_expense)}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).duration(450)}>
              <SectionTitle title="Contas conectadas" action="+ Conectar" onAction={() => router.push("/connect-bank")} testID="connect-bank-link" />
              {d.accounts.length === 0 ? (
                <EmptyState
                  testID="no-banks-empty"
                  icon="business"
                  title="Nenhum banco conectado"
                  text="Conecte suas contas via Open Finance para ver saldos e transações automaticamente."
                  action="Conectar banco"
                  onAction={() => router.push("/connect-bank")}
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.md }}>
                  {d.accounts.map((a) => (
                    <View key={a.account_id} style={styles.bankCard} testID={`account-card-${a.institution_id}`}>
                      <BankAvatar initials={a.initials} color={a.color} />
                      <Text style={styles.bankName} numberOfLines={1}>{a.institution_name}</Text>
                      <Text style={styles.bankSub}>{a.type} {a.number}</Text>
                      <Text style={styles.bankBalance}>{money(a.balance)}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </Animated.View>

            {d.household?.members?.length > 1 ? (
              <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.card} testID="household-summary">
                <SectionTitle title={d.household.name} action="Gerenciar" onAction={() => router.push("/household")} testID="manage-household-link" />
                <View style={{ gap: S.md }}>
                  {d.household.members.map((m) => (
                    <View key={m.user_id} style={styles.memberRow} testID={`member-summary-${m.user_id}`}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitial}>{m.name?.[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {m.name?.split(" ")[0]}{m.user_id === user?.user_id ? " (você)" : ""}
                      </Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.memberFlow, { color: colors.success }]}>+{money(m.income)}</Text>
                        <Text style={styles.memberFlow}>-{money(m.expense)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(160).duration(450)}>
              <Pressable testID="ai-teaser-card" onPress={() => router.push("/insights")}>
                <LinearGradient colors={[colors.brandGlow, colors.surfaceSecondary]} style={styles.aiCard}>
                  <View style={styles.aiIcon}>
                    <Icon name="sparkles" size={20} color={colors.onBrandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiTitle}>Insights com IA</Text>
                    <Text style={styles.aiText}>Descubra onde economizar e como bater suas metas.</Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={colors.muted} />
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {d.by_category.length ? (
              <Animated.View entering={FadeInDown.delay(240).duration(450)} style={styles.card}>
                <SectionTitle title="Gastos do mês" />
                <View style={{ gap: S.md }}>
                  {d.by_category.slice(0, 5).map((c) => (
                    <View key={c.category} style={{ gap: 6 }} testID={`category-spend-${c.category}`}>
                      <View style={styles.catRow}>
                        <Text style={styles.catLabel}>{catMeta(c.category).label}</Text>
                        <Text style={styles.catValue}>{money(c.amount)}</Text>
                      </View>
                      <ProgressBar value={c.amount / maxCat} />
                    </View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {d.recent.length ? (
              <Animated.View entering={FadeInDown.delay(320).duration(450)} style={styles.card}>
                <SectionTitle title="Recentes" action="Ver todas" onAction={() => router.push("/transactions")} testID="see-all-transactions" />
                {d.recent.map((t) => (
                  <TransactionRow key={t.transaction_id} tx={t} testID={`recent-tx-${t.transaction_id}`} />
                ))}
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Pressable
        testID="add-transaction-fab"
        onPress={() => router.push("/add-transaction")}
        style={({ pressed }) => [styles.fab, { bottom: bottomChrome + 16, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Icon name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <Sheet visible={profileOpen} onClose={() => setProfileOpen(false)} title="Minha conta" testID="profile-sheet">
        <View style={{ gap: 4 }}>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail} testID="profile-email">{user?.email}</Text>
        </View>
        <Button
          testID="profile-household-button"
          variant="secondary"
          icon="home-outline"
          title={d?.household ? d.household.name : "Criar ou entrar em uma casa"}
          onPress={() => {
            setProfileOpen(false);
            router.push("/household");
          }}
        />
        <Button testID="logout-button" variant="danger" icon="log-out-outline" title="Sair" onPress={logout} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  hello: { fontFamily: F.text, fontSize: 14, color: colors.muted },
  name: { fontFamily: F.display, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onBrandTertiary },
  housePill: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 36, maxWidth: 140, paddingHorizontal: S.md, marginRight: S.sm,
    borderRadius: R.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border,
  },
  housePillText: { fontFamily: F.text, fontSize: 13, fontWeight: "700", color: colors.onBrandTertiary, flexShrink: 1 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  memberInitial: { fontFamily: F.display, fontSize: 15, fontWeight: "700", color: colors.onBrandTertiary },
  memberName: { flex: 1, fontFamily: F.text, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  memberFlow: { fontFamily: F.display, fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary },
  hero: { borderRadius: R.lg, padding: S.xl, gap: S.md, borderWidth: 1, borderColor: colors.border },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontFamily: F.text, fontSize: 14, fontWeight: "600", color: colors.onBrandTertiary },
  balance: { fontFamily: F.display, fontSize: 38, fontWeight: "700", color: colors.onSurface, letterSpacing: -1 },
  flowRow: { flexDirection: "row", gap: S.lg, marginTop: S.sm },
  flow: { flex: 1, flexDirection: "row", gap: S.sm, alignItems: "center" },
  flowLabel: { fontFamily: F.text, fontSize: 12, color: colors.onSurfaceTertiary },
  flowValue: { fontFamily: F.display, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  bankCard: {
    width: 168, padding: S.lg, gap: S.xs, borderRadius: R.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  bankName: { fontFamily: F.text, fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: S.sm },
  bankSub: { fontFamily: F.text, fontSize: 12, color: colors.muted },
  bankBalance: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface, marginTop: S.sm },
  aiCard: {
    flexDirection: "row", alignItems: "center", gap: S.md, padding: S.lg,
    borderRadius: R.lg, borderWidth: 1, borderColor: colors.brandTertiary,
  },
  aiIcon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontFamily: F.display, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  aiText: { fontFamily: F.text, fontSize: 13, color: colors.muted, marginTop: 2 },
  card: { padding: S.lg, borderRadius: R.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  catRow: { flexDirection: "row", justifyContent: "space-between" },
  catLabel: { fontFamily: F.text, fontSize: 14, color: colors.onSurfaceSecondary },
  catValue: { fontFamily: F.display, fontSize: 14, fontWeight: "700", color: colors.onSurface },
  fab: {
    position: "absolute", right: S.lg, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
  },
  profileName: { ...StyleSheet.flatten(ui.sheetTitle), fontSize: 18 },
  profileEmail: { fontFamily: F.text, fontSize: 14, color: colors.muted },
});
