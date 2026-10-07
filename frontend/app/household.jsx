import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, ErrorState, F, Field, Icon, R, S, Sheet, Skeleton, useToast } from "@/src/ui";
import { colors } from "@/src/theme";

const BENEFITS = [
  ["swap-horizontal-outline", "Receitas e despesas de todos os membros em um só lugar"],
  ["pie-chart-outline", "Orçamentos e metas compartilhados"],
  ["sparkles-outline", "Insights da IA sobre as finanças da casa"],
];

export default function Household() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // null | create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState(null); // {type: 'leave'} | {type: 'remove', member}

  const q = useQuery({ queryKey: ["household"], queryFn: () => api("/household") });
  const h = q.data;
  const isOwner = h?.owner_id === user?.user_id;

  const done = (msg) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    qc.invalidateQueries();
    setMode(null);
    setConfirm(null);
    toast(msg);
  };
  const onError = (e) => toast(e.message, "error");

  const create = useMutation({
    mutationFn: () => api("/household", { method: "POST", body: { name: name.trim() } }),
    onSuccess: () => done("Casa criada! Compartilhe o código de convite."),
    onError,
  });
  const join = useMutation({
    mutationFn: () => api("/household/join", { method: "POST", body: { invite_code: code.trim().toUpperCase() } }),
    onSuccess: (d) => done(`Você entrou em ${d.name}`),
    onError,
  });
  const leave = useMutation({
    mutationFn: () => api("/household/leave", { method: "POST" }),
    onSuccess: () => done("Você saiu da casa"),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id) => api(`/household/members/${id}`, { method: "DELETE" }),
    onSuccess: () => done("Membro removido"),
    onError,
  });

  const copyCode = async () => {
    await Clipboard.setStringAsync(h.invite_code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toast("Código copiado");
  };
  const shareCode = () =>
    Share.share({
      message: `Entre na minha casa "${h.name}" no FinAI para compartilharmos nossas finanças. Código de convite: ${h.invite_code}`,
    }).catch(() => {});

  return (
    <View style={[styles.root, { paddingTop: insets.top + S.md }]} testID="household-screen">
      <View style={styles.header}>
        <Pressable testID="household-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="close" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Minha casa</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.lg, paddingBottom: insets.bottom + S.xl }}>
        {q.isLoading ? (
          <>
            <Skeleton height={140} />
            <Skeleton height={96} />
          </>
        ) : q.isError ? (
          <ErrorState onRetry={q.refetch} />
        ) : !h ? (
          <>
            <View style={styles.heroIcon}>
              <Icon name="home" size={36} color={colors.brandPrimary} />
            </View>
            <Text style={styles.heroTitle}>Finanças em família</Text>
            <Text style={styles.heroText}>
              Crie uma casa e convide quem divide a vida com você. Todos os membros veem as mesmas receitas, despesas, orçamentos e metas.
            </Text>
            <View style={{ gap: S.sm }}>
              {BENEFITS.map(([ic, l]) => (
                <View key={l} style={styles.benefit}>
                  <Icon name={ic} size={22} color={colors.brandSecondary} />
                  <Text style={styles.benefitText}>{l}</Text>
                </View>
              ))}
            </View>
            <Button testID="create-household-button" title="Criar uma casa" icon="add-circle-outline" onPress={() => setMode("create")} />
            <Button testID="join-household-button" variant="secondary" title="Entrar com código de convite" icon="key-outline" onPress={() => setMode("join")} />
          </>
        ) : (
          <>
            <View style={styles.card} testID="household-card">
              <View style={styles.cardTop}>
                <View style={styles.houseIcon}>
                  <Icon name="home" size={22} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.houseName} testID="household-name">{h.name}</Text>
                  <Text style={styles.houseSub}>
                    {h.members.length} {h.members.length === 1 ? "membro" : "membros"} · dados compartilhados
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.inviteCard} testID="invite-card">
              <Text style={styles.inviteLabel}>Código de convite</Text>
              <Text style={styles.inviteCode} testID="invite-code">{h.invite_code}</Text>
              <Text style={styles.inviteHint}>Peça para a pessoa abrir Minha casa → Entrar com código.</Text>
              <View style={styles.inviteActions}>
                <Button testID="copy-invite-button" variant="secondary" title="Copiar" icon="copy-outline" onPress={copyCode} style={{ flex: 1 }} />
                <Button testID="share-invite-button" title="Convidar" icon="share-social-outline" onPress={shareCode} style={{ flex: 1 }} />
              </View>
            </View>

            <Text style={styles.section}>Membros</Text>
            {h.members.map((m) => (
              <View key={m.user_id} style={styles.memberRow} testID={`member-${m.user_id}`}>
                <View style={styles.avatar}>
                  {m.picture ? (
                    <Image source={{ uri: m.picture }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{m.name?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name}{m.user_id === user?.user_id ? " (você)" : ""}
                  </Text>
                  <Text style={styles.memberEmail} numberOfLines={1}>{m.email}</Text>
                </View>
                {m.role === "owner" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Dono</Text>
                  </View>
                ) : isOwner ? (
                  <Pressable testID={`remove-member-${m.user_id}`} onPress={() => setConfirm({ type: "remove", member: m })} style={styles.iconBtn} hitSlop={8}>
                    <Icon name="person-remove-outline" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            ))}

            <Button testID="leave-household-button" variant="danger" title="Sair da casa" icon="exit-outline" onPress={() => setConfirm({ type: "leave" })} />
          </>
        )}
      </ScrollView>

      <Sheet visible={mode === "create"} onClose={() => setMode(null)} title="Criar casa" testID="create-household-sheet">
        <Field testID="household-name-input" label="Nome da casa" placeholder="Ex.: Casa Silva" value={name} onChangeText={setName} autoFocus maxLength={40} />
        <Button
          testID="confirm-create-household"
          title="Criar casa"
          loading={create.isPending}
          onPress={() => (name.trim() ? create.mutate() : toast("Dê um nome para a casa", "error"))}
        />
      </Sheet>

      <Sheet visible={mode === "join"} onClose={() => setMode(null)} title="Entrar em uma casa" testID="join-household-sheet">
        <Field
          testID="invite-code-input"
          label="Código de convite"
          placeholder="ABC123"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          autoFocus
          style={styles.codeInput}
        />
        <Button
          testID="confirm-join-household"
          title="Entrar"
          loading={join.isPending}
          onPress={() => (code.trim().length === 6 ? join.mutate() : toast("O código tem 6 caracteres", "error"))}
        />
      </Sheet>

      <Sheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "leave" ? "Sair da casa?" : "Remover membro?"}
        testID="confirm-sheet"
      >
        <Text style={styles.heroText}>
          {confirm?.type === "leave"
            ? "Você deixará de ver os dados dos outros membros e eles não verão mais os seus. Seus dados continuam com você."
            : `${confirm?.member?.name} deixará de ver os dados da casa e vocês não verão mais os dados dessa pessoa.`}
        </Text>
        <Button
          testID="confirm-action-button"
          variant="danger"
          title={confirm?.type === "leave" ? "Sair da casa" : "Remover"}
          loading={leave.isPending || remove.isPending}
          onPress={() => (confirm?.type === "leave" ? leave.mutate() : remove.mutate(confirm.member.user_id))}
        />
        <Button testID="cancel-action-button" variant="secondary" title="Cancelar" onPress={() => setConfirm(null)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: S.lg },
  headerTitle: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  heroIcon: { alignSelf: "center", width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandGlow, alignItems: "center", justifyContent: "center", marginTop: S.lg },
  heroTitle: { fontFamily: F.display, fontSize: 24, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  heroText: { fontFamily: F.text, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: "center" },
  benefit: { flexDirection: "row", alignItems: "center", gap: S.md, padding: S.md, borderRadius: R.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  benefitText: { flex: 1, fontFamily: F.text, fontSize: 14, fontWeight: "600", color: colors.onSurface },
  card: { padding: S.lg, borderRadius: R.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  houseIcon: { width: 48, height: 48, borderRadius: R.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  houseName: { fontFamily: F.display, fontSize: 20, fontWeight: "700", color: colors.onSurface },
  houseSub: { fontFamily: F.text, fontSize: 13, color: colors.muted, marginTop: 2 },
  inviteCard: { padding: S.lg, gap: S.sm, borderRadius: R.lg, backgroundColor: colors.brandGlow, borderWidth: 1, borderColor: colors.brandTertiary, alignItems: "center" },
  inviteLabel: { fontFamily: F.text, fontSize: 13, fontWeight: "600", color: colors.onBrandTertiary },
  inviteCode: { fontFamily: F.display, fontSize: 36, fontWeight: "700", letterSpacing: 8, color: colors.onSurface },
  inviteHint: { fontFamily: F.text, fontSize: 12, color: colors.muted, textAlign: "center" },
  inviteActions: { flexDirection: "row", gap: S.sm, alignSelf: "stretch", marginTop: S.sm },
  section: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: S.md, padding: S.md, minHeight: 68,
    borderRadius: R.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 44, height: 44 },
  avatarText: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onBrandTertiary },
  memberName: { fontFamily: F.text, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  memberEmail: { fontFamily: F.text, fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.pill, backgroundColor: colors.brandTertiary },
  badgeText: { fontFamily: F.text, fontSize: 12, fontWeight: "700", color: colors.onBrandTertiary },
  codeInput: { fontFamily: F.display, fontSize: 24, letterSpacing: 6, textAlign: "center" },
});
