import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, useAuth } from "@/src/auth";
import { ToastProvider } from "@/src/ui";
import { colors } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

function Gate() {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <View testID="app-loading" style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="connect-bank" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-transaction" options={{ presentation: "modal" }} />
        <Stack.Screen name="household" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Prewarm custom fonts and the icon font so icons render on first paint
  // (fixes icons not loading in Expo Go Android).
  const [loaded] = useFonts({
    SpaceGrotesk: require("../assets/fonts/SpaceGrotesk.ttf"),
    PlusJakarta: require("../assets/fonts/PlusJakartaSans.ttf"),
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <StatusBar style="light" />
            <ToastProvider>
              <AuthProvider>
                {loaded ? <Gate /> : <View style={{ flex: 1, backgroundColor: colors.surface }} />}
              </AuthProvider>
            </ToastProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
