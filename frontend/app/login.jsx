import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAuth } from "@/src/auth";
import { Button, F, Field, Icon, R, S, useToast } from "@/src/ui";
import { colors } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1593900154763-1db4833d1784?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { login, register, loginWithGoogle } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email.trim() || !password || (mode === "register" && !name.trim())) {
      setError("Preencha todos os campos.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setGLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      toast(e.message || "Falha no login com Google", "error");
    } finally {
      setGLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["transparent", colors.scrim, colors.surface]} locations={[0, 0.5, 0.8]} style={StyleSheet.absoluteFill} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + S.xxxl, paddingBottom: insets.bottom + S.xl }]}
      >
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brandRow}>
          <View style={styles.logo}>
            <Icon name="sparkles" size={22} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>FinAI</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.title}>Seu dinheiro,{"\n"}com inteligência.</Text>
          <Text style={styles.subtitle}>Conecte seus bancos via Open Finance e receba insights com IA.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.card}>
          <View style={styles.segment}>
            {[
              ["login", "Entrar"],
              ["register", "Criar conta"],
            ].map(([k, l]) => (
              <Pressable
                key={k}
                testID={`auth-mode-${k}`}
                onPress={() => {
                  setMode(k);
                  setError("");
                }}
                style={[styles.segBtn, mode === k && styles.segActive]}
              >
                <Text style={[styles.segText, mode === k && { color: colors.onSurface }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
          {mode === "register" ? (
            <Field testID="register-name-input" label="Nome" placeholder="Seu nome" value={name} onChangeText={setName} />
          ) : null}
          <Field
            testID="auth-email-input"
            label="Email"
            placeholder="voce@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            testID="auth-password-input"
            label="Senha"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {error ? (
            <Text testID="auth-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button
            testID="auth-submit-button"
            title={mode === "login" ? "Entrar" : "Criar conta"}
            onPress={submit}
            loading={loading}
          />
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>ou</Text>
            <View style={styles.line} />
          </View>
          <Button testID="google-login-button" variant="light" icon="logo-google" title="Continuar com Google" onPress={google} loading={gLoading} />
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: S.lg, gap: S.xl, justifyContent: "flex-end" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  logo: { width: 40, height: 40, borderRadius: R.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: F.display, fontSize: 24, fontWeight: "700", color: colors.onSurface },
  title: { fontFamily: F.display, fontSize: 36, lineHeight: 42, fontWeight: "700", color: colors.onSurface },
  subtitle: { fontFamily: F.text, fontSize: 15, lineHeight: 22, color: colors.onSurfaceTertiary, marginTop: S.sm },
  card: {
    backgroundColor: colors.glass,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: S.lg,
    gap: S.lg,
  },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: R.md, padding: S.xs },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: R.sm + 2 },
  segActive: { backgroundColor: colors.surfaceSecondary },
  segText: { fontFamily: F.text, fontSize: 14, fontWeight: "700", color: colors.muted },
  error: { fontFamily: F.text, fontSize: 13, color: colors.error },
  divider: { flexDirection: "row", alignItems: "center", gap: S.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { fontFamily: F.text, fontSize: 13, color: colors.muted },
});
