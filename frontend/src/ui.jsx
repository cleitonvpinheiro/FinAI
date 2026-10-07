import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { colors } from "@/src/theme";

export const Icon = Ionicons;
export const F = { display: "SpaceGrotesk", text: "PlusJakarta" };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

export const CATEGORIES = {
  alimentacao: { label: "Alimentação", icon: "restaurant" },
  transporte: { label: "Transporte", icon: "car" },
  moradia: { label: "Moradia", icon: "home" },
  lazer: { label: "Lazer", icon: "game-controller" },
  saude: { label: "Saúde", icon: "medkit" },
  compras: { label: "Compras", icon: "bag-handle" },
  educacao: { label: "Educação", icon: "school" },
  assinaturas: { label: "Assinaturas", icon: "repeat" },
  salario: { label: "Salário", icon: "briefcase" },
  investimentos: { label: "Investimentos", icon: "trending-up" },
  outros: { label: "Outros", icon: "ellipsis-horizontal" },
};
export const EXPENSE_CATS = ["alimentacao", "transporte", "moradia", "lazer", "saude", "compras", "educacao", "assinaturas", "outros"];
export const INCOME_CATS = ["salario", "investimentos", "outros"];
export const catMeta = (k) => CATEGORIES[k] || CATEGORIES.outros;

export function brl(n = 0) {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function Button({ title, onPress, loading, variant = "primary", icon, disabled, testID, style }) {
  const v = variants[variant];
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={v.fg} /> : null}
          <Text style={[styles.btnText, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const variants = {
  primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary, border: colors.brandPrimary },
  secondary: { bg: colors.surfaceTertiary, fg: colors.onSurface, border: colors.borderStrong },
  danger: { bg: "transparent", fg: colors.error, border: colors.error },
  light: { bg: colors.surfaceInverse, fg: colors.onSurfaceInverse, border: colors.surfaceInverse },
};

export function Chip({ label, selected, onPress, icon, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.brandTertiary : colors.surfaceSecondary,
          borderColor: selected ? colors.brandPrimary : colors.border,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? colors.onBrandTertiary : colors.muted} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.onBrandTertiary : colors.onSurfaceSecondary }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
    >
      {children}
    </ScrollView>
  );
}

export function Field({ label, testID, style, ...props }) {
  return (
    <View style={{ gap: S.sm }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput testID={testID} placeholderTextColor={colors.muted} style={[styles.input, style]} {...props} />
    </View>
  );
}

export function ProgressBar({ value, color = colors.brandPrimary, height = 8, testID }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <View testID={testID} style={[styles.track, { height }]}>
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: R.pill }} />
    </View>
  );
}

export function BankAvatar({ initials, color, size = 40 }) {
  return (
    <View style={[styles.bankAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.bankInitials, { fontSize: size * 0.3 }]}>{initials}</Text>
    </View>
  );
}

export function CatIcon({ category, size = 44 }) {
  return (
    <View style={[styles.catIcon, { width: size, height: size }]}>
      <Icon name={catMeta(category).icon} size={size * 0.45} color={colors.onBrandTertiary} />
    </View>
  );
}

export function TransactionRow({ tx, onPress, testID }) {
  const income = tx.type === "income";
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.txRow, pressed && { opacity: 0.7 }]}>
      <CatIcon category={tx.category} />
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle} numberOfLines={1}>{tx.description}</Text>
        <Text style={styles.txSub} numberOfLines={1}>
          {catMeta(tx.category).label} · {tx.institution} · {shortDate(tx.date)}
          {tx.owner_name ? ` · ${tx.owner_name.split(" ")[0]}` : ""}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: income ? colors.success : colors.onSurface }]}>
        {income ? "+" : "-"}{brl(tx.amount)}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction, testID }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={12}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction, testID }) {
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.brandSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action ? <Button title={action} onPress={onAction} testID={`${testID}-cta`} style={{ alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export function ErrorState({ onRetry, testID = "error-state" }) {
  return (
    <EmptyState
      testID={testID}
      icon="cloud-offline"
      title="Não foi possível carregar"
      text="Verifique sua conexão e tente novamente."
      action="Tentar novamente"
      onAction={onRetry}
    />
  );
}

export function Skeleton({ height = 64, style }) {
  return <View style={[{ height, borderRadius: R.md, backgroundColor: colors.surfaceSecondary }, style]} />;
}

// Bottom sheet built on Modal; keyboard-aware.
export function Sheet({ visible, onClose, title, children, testID }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} testID={`${testID}-backdrop`} />
        <View testID={testID} style={[styles.sheet, { paddingBottom: insets.bottom + S.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable testID={`${testID}-close`} onPress={onClose} hitSlop={12} style={styles.iconBtn}>
              <Icon name="close" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.lg }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Lightweight markdown: headings, bullets, **bold**.
export function Markdown({ text, testID }) {
  const lines = (text || "").split("\n");
  const inline = (s, key) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <Text key={`${key}-${i}`} style={{ fontWeight: "700", color: colors.onSurface }}>{part.slice(2, -2)}</Text>
      ) : (
        part
      ),
    );
  return (
    <View testID={testID} style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line || line === "---") return null;
        if (line.startsWith("#")) {
          return <Text key={i} style={styles.mdHeading}>{line.replace(/^#+\s*/, "").replace(/\*\*/g, "")}</Text>;
        }
        if (/^([-*•]|\d+\.)\s/.test(line)) {
          return (
            <View key={i} style={{ flexDirection: "row", gap: S.sm }}>
              <Text style={styles.mdBullet}>•</Text>
              <Text style={[styles.mdText, { flex: 1 }]}>{inline(line.replace(/^([-*•]|\d+\.)\s/, ""), i)}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.mdText}>{inline(line, i)}</Text>;
      })}
    </View>
  );
}

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, type = "success") => {
    clearTimeout(timer.current);
    setToast({ message, type, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp}
          exiting={FadeOutUp}
          pointerEvents="none"
          testID="toast"
          style={[styles.toast, { top: insets.top + S.sm }]}
        >
          <Icon
            name={toast.type === "error" ? "alert-circle" : "checkmark-circle"}
            size={20}
            color={toast.type === "error" ? colors.error : colors.brandPrimary}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: R.md,
    borderWidth: 1,
    paddingHorizontal: S.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
  },
  btnText: { fontFamily: F.text, fontSize: 16, fontWeight: "700" },
  chipRow: { flexGrow: 0, height: 56 },
  chipRowContent: { gap: S.sm, paddingHorizontal: S.lg, alignItems: "center" },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: S.md,
    borderRadius: R.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontFamily: F.text, fontSize: 13, fontWeight: "600" },
  label: { fontFamily: F.text, fontSize: 13, color: colors.muted, fontWeight: "600" },
  input: {
    minHeight: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: S.lg,
    color: colors.onSurface,
    fontFamily: F.text,
    fontSize: 16,
  },
  track: { backgroundColor: colors.surfaceTertiary, borderRadius: R.pill, overflow: "hidden" },
  bankAvatar: { alignItems: "center", justifyContent: "center" },
  bankInitials: { color: "#FFFFFF", fontFamily: F.display, fontWeight: "700" },
  catIcon: { borderRadius: R.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  txRow: { flexDirection: "row", alignItems: "center", gap: S.md, minHeight: 64, paddingVertical: S.sm },
  txTitle: { fontFamily: F.text, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  txSub: { fontFamily: F.text, fontSize: 12, color: colors.muted, marginTop: 2 },
  txAmount: { fontFamily: F.display, fontSize: 15, fontWeight: "700" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: S.md },
  sectionTitle: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface },
  sectionAction: { fontFamily: F.text, fontSize: 14, fontWeight: "700", color: colors.brandSecondary },
  empty: {
    alignItems: "center",
    gap: S.md,
    padding: S.xl,
    borderRadius: R.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: F.display, fontSize: 18, fontWeight: "700", color: colors.onSurface, textAlign: "center" },
  emptyText: { fontFamily: F.text, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: S.md },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg },
  sheetTitle: { fontFamily: F.display, fontSize: 20, fontWeight: "700", color: colors.onSurface },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  mdHeading: { fontFamily: F.display, fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: S.sm },
  mdText: { fontFamily: F.text, fontSize: 14, lineHeight: 21, color: colors.onSurfaceSecondary },
  mdBullet: { color: colors.brandPrimary, fontSize: 14, lineHeight: 21 },
  toast: {
    position: "absolute",
    left: S.lg,
    right: S.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm,
    padding: S.lg,
    borderRadius: R.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  toastText: { flex: 1, fontFamily: F.text, fontSize: 14, fontWeight: "600", color: colors.onSurface },
});
