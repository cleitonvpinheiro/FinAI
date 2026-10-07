import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { usesNativeTabs } from "@/src/navigation";
import { F, Icon, tap } from "@/src/ui";
import { colors } from "@/src/theme";

const TABS = [
  { name: "index", label: "Início", sf: "house.fill", icon: "home" },
  { name: "transactions", label: "Transações", sf: "list.bullet", icon: "swap-vertical" },
  { name: "plans", label: "Planos", sf: "target", icon: "pie-chart" },
  { name: "insights", label: "Insights", sf: "sparkles", icon: "sparkles" },
];

export default function TabsLayout() {
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs
      screenListeners={{ tabPress: tap }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: F.text, fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => (
              <Icon name={focused ? t.icon : `${t.icon}-outline`} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
