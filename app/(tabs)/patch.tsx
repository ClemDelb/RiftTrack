import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ── Helpers ───────────────────────────────────────────────────────────────────

// "26.7" → "26-7"
function toSlug(version: string): string {
  return version.replace('.', '-');
}

// "26.7" → "Patch 26.7" (translated)
function toLabel(version: string): string {
  return i18n.t('patch.label', { version })
}

function patchUrl(version: string): string {
  const lang = i18n.language === 'fr' ? 'fr-fr' : 'en-gb'
  return `https://www.leagueoflegends.com/${lang}/news/game-updates/league-of-legends-patch-${toSlug(version)}-notes/`
}

// Riot releases patches every ~2 weeks starting ~Jan 8 each year.
// The website uses year-based versioning: 26.1, 26.2 … 26.N
function generateVersions(): string[] {
  const now       = new Date();
  const year      = now.getFullYear();
  const yearShort = year % 100; // 2026 → 26

  // Estimate current patch: patches start ~Jan 8, one every 14 days
  const yearStart   = new Date(year, 0, 8).getTime();
  const weeksIn     = Math.floor((now.getTime() - yearStart) / (14 * 24 * 60 * 60 * 1000));
  const latestPatch = Math.min(Math.max(weeksIn + 1, 1), 25);

  const versions: string[] = [];

  for (let i = 0; i < 4; i++) {
    const patch = latestPatch - i;
    if (patch >= 1) {
      versions.push(`${yearShort}.${patch}`);
    } else {
      // Overflow to previous year
      const prevShort = yearShort - 1;
      versions.push(`${prevShort}.${24 + patch}`);
    }
  }

  return versions;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PatchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation()

  const [versions,      setVersions]      = useState<string[]>([]);
  const [selected,      setSelected]      = useState('');
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const list = generateVersions();
    setVersions(list);
    setSelected(list[0] ?? '');
    setLoading(false);
  }, []);

  if (loading || !selected) {
    return <View style={styles.root} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLine} />
        <Text style={styles.headerTitle}>{t('patch.header')}</Text>
        <View style={styles.headerLine} />
      </View>

      {/* ── Version dropdown ────────────────────────────────────────────── */}
      <View style={styles.dropdownRow}>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setDropdownOpen(true)}
          activeOpacity={0.8}>
          <Text style={styles.dropdownBtnText}>{toLabel(selected)}</Text>
          <IconSymbol name="chevron.down" size={14} color={LoL.gold} />
        </TouchableOpacity>
      </View>

      {/* ── WebView ─────────────────────────────────────────────────────── */}
      {selected ? (
        <WebView
          key={selected}
          source={{ uri: patchUrl(selected) }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoader}>
              <ActivityIndicator color={LoL.gold} size="large" />
              <Text style={styles.webviewLoaderText}>{t('patch.loading')}</Text>
            </View>
          )}
        />
      ) : null}

      {/* ── Dropdown modal ──────────────────────────────────────────────── */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}>
          <View style={[styles.dropdownList, { marginTop: insets.top + 96 }]}>
            <FlatList
              data={versions}
              keyExtractor={v => v}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item === selected;
                return (
                  <TouchableOpacity
                    style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                    onPress={() => { setSelected(item); setDropdownOpen(false); }}
                    activeOpacity={0.7}>
                    <Text style={[styles.dropdownItemText, active && { color: LoL.gold }]}>
                      {toLabel(item)}
                    </Text>
                    {active && (
                      <IconSymbol name="checkmark" size={14} color={LoL.gold} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
  },
  centered: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: LoL.goldDark,
  },
  headerTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.gold,
    letterSpacing: 3,
  },

  // Dropdown trigger
  dropdownRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dropdownBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: LoL.goldLight,
    letterSpacing: 0.5,
  },

  // WebView
  webview: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
  },
  webviewLoader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: LoL.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  webviewLoaderText: {
    color: LoL.textSecondary,
    fontSize: FontSize.sm,
  },

  // Modal dropdown
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(1, 10, 19, 0.75)',
  },
  dropdownList: {
    marginHorizontal: Spacing.lg,
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.md,
    maxHeight: 320,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
  },
  dropdownItemActive: {
    backgroundColor: LoL.goldDeep,
  },
  dropdownItemText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: LoL.textSecondary,
    letterSpacing: 0.3,
  },
});
