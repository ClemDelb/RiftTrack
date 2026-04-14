import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoL } from '@/constants/theme'

function TabBarBackground() {
    return <View style={styles.tabBarBackground} />
}

export default function TabLayout() {
    const insets = useSafeAreaInsets()
    const { t } = useTranslation()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarActiveTintColor: LoL.tabActive,
          tabBarInactiveTintColor: LoL.tabInactive,
          tabBarStyle: {
              ...styles.tabBar,
              height: 54 + insets.bottom,
              paddingBottom: insets.bottom + 6,
          },
          tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, focused }) => (
                <IconSymbol size={focused ? 26 : 24} name="person.fill" color={color} />
            ),
        }}
      />
        <Tabs.Screen
            name="champions"
            options={{
                title: t('tabs.champions'),
                tabBarIcon: ({ color, focused }) => (
                    <IconSymbol size={focused ? 26 : 24} name="shield.fill" color={color} />
                ),
            }}
        />
        <Tabs.Screen
            name="history"
            options={{
                title: t('tabs.history'),
                tabBarIcon: ({ color, focused }) => (
                    <IconSymbol size={focused ? 26 : 24} name="clock.fill" color={color} />
                ),
        }}
      />
      <Tabs.Screen
          name="patch"
        options={{
            title: t('tabs.patch'),
            tabBarIcon: ({ color, focused }) => (
                <IconSymbol size={focused ? 26 : 24} name="scroll.fill" color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: LoL.tabBg,
        borderTopWidth: 1,
        borderTopColor: LoL.tabBorder,
        paddingTop: 6,
        elevation: 0,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    tabBarBackground: {
        flex: 1,
        backgroundColor: LoL.tabBg,
    },
})
