// Design tokens (dark only), filled from /app/design_guidelines.json.
// A plain key is a background; its `on` partner is the text/icon color on it.
import { useMemo } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0A0A0A",
  onSurface: "#F9FAFB",
  surfaceSecondary: "#171717",
  onSurfaceSecondary: "#E5E7EB",
  surfaceTertiary: "#262626",
  onSurfaceTertiary: "#D1D5DB",
  surfaceInverse: "#F3F4F6",
  onSurfaceInverse: "#111827",
  muted: "#9CA3AF",

  brand: "#10B981",
  onBrand: "#022C22",
  brandPrimary: "#10B981",
  onBrandPrimary: "#022C22",
  brandSecondary: "#34D399",
  onBrandSecondary: "#064E3B",
  brandTertiary: "#065F46",
  onBrandTertiary: "#A7F3D0",

  success: "#22C55E",
  onSuccess: "#052E16",
  warning: "#F59E0B",
  onWarning: "#451A03",
  error: "#EF4444",
  onError: "#450A0A",
  info: "#0D9488",
  onInfo: "#042F2E",

  border: "#262626",
  borderStrong: "#404040",
  divider: "#1F1F1F",

  // extra tokens
  glass: "rgba(23,23,23,0.82)",
  scrim: "rgba(10,10,10,0.92)",
  brandGlow: "rgba(16,185,129,0.14)",
  overlay: "rgba(0,0,0,0.6)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark: ThemeColors } = { light: dark, dark };

export const colors = dark;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// App ships a single dark theme; keep native chrome dark too.
setColorScheme?.("dark");

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  return { scheme: "dark", colors: dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}
