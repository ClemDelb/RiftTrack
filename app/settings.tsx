import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme';
import { PLATFORMS, getAccount, getSummoner } from '@/services/riot-api';
import { useSummoner, StoredConfig } from '@/contexts/summoner';
import { useHomeConfig } from '@/contexts/home-config';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { saveConfig, storedConfig, clearConfig } = useSummoner();
  const { homeConfig, updateHomeConfig } = useHomeConfig();

  // Form state
  const [riotId, setRiotId]       = useState(
    storedConfig ? `${storedConfig.gameName}#${storedConfig.tagLine}` : ''
  );
  const [platform, setPlatform]   = useState(storedConfig?.platform ?? 'euw1');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [searchError, setError]   = useState<string | null>(null);
  const [preview, setPreview]     = useState<StoredConfig | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    setError(null);
    setPreview(null);

    const [gameName, ...tagParts] = riotId.trim().split('#');
    const tagLine = tagParts.join('#');

    if (!gameName || !tagLine) {
      setError('Format invalide — utilise PseudoIngame#TAG');
      return;
    }

    setSearching(true);
    try {
      const account  = await getAccount(gameName.trim(), tagLine.trim(), platform);
      const summoner = await getSummoner(account.puuid, platform);
      setPreview({
        gameName:      account.gameName,
        tagLine:       account.tagLine,
        platform,
        puuid:         account.puuid,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSearching(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      await saveConfig(preview);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Riot ID input ───────────────────────────────────────────── */}
        <SectionLabel>VOTRE COMPTE</SectionLabel>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pseudo · Tag</Text>
          <TextInput
            style={styles.input}
            value={riotId}
            onChangeText={v => { setRiotId(v); setPreview(null); setError(null); }}
            placeholder="Faker#EUW"
            placeholderTextColor={LoL.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Text style={styles.hint}>Format : PseudoIngame#TAG (ex: Faker#EUW)</Text>
        </View>

        {/* ── Region chips ────────────────────────────────────────────── */}
        <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Région</Text>
        <View style={styles.chips}>
          {PLATFORMS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, platform === p.value && styles.chipActive]}
              onPress={() => { setPlatform(p.value); setPreview(null); }}>
              <Text style={[styles.chipLabel, platform === p.value && styles.chipLabelActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Search button ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btnGold, searching && styles.btnDisabled]}
          onPress={handleSearch}
          disabled={searching}>
          {searching
            ? <ActivityIndicator color={LoL.bg} />
            : <Text style={styles.btnGoldLabel}>RECHERCHER</Text>}
        </TouchableOpacity>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {searchError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}

        {/* ── Preview card ─────────────────────────────────────────────── */}
        {preview && (
          <>
            <SectionLabel style={{ marginTop: Spacing.xl }}>INVOCATEUR TROUVÉ</SectionLabel>
            <View style={styles.previewCard}>
              <Image
                source={{
                  uri: `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${preview.profileIconId}.png`,
                }}
                style={styles.previewIcon}
                contentFit="cover"
              />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>
                  {preview.gameName}
                  <Text style={styles.previewTag}>#{preview.tagLine}</Text>
                </Text>
                <Text style={styles.previewLevel}>Niveau {preview.summonerLevel}</Text>
                <Text style={styles.previewRegion}>
                  {PLATFORMS.find(p => p.value === preview.platform)?.label ?? preview.platform}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnGold, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color={LoL.bg} />
                : <Text style={styles.btnGoldLabel}>ENREGISTRER</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── Home customization ───────────────────────────────────────── */}
        <SectionLabel style={{ marginTop: Spacing.xl }}>PERSONNALISER L'ACCUEIL</SectionLabel>

        <View style={styles.switchGroup}>
          <SwitchRow
            label="Solo Queue"
            description="Rang, victoires, défaites et winrate"
            value={homeConfig.showSoloQueue}
            onValueChange={v => updateHomeConfig({ showSoloQueue: v })}
          />
          <View style={styles.switchDivider} />
          <SwitchRow
            label="Flex Queue"
            description="Rang en file flexible 5v5"
            value={homeConfig.showFlexQueue}
            onValueChange={v => updateHomeConfig({ showFlexQueue: v })}
          />
          <View style={styles.switchDivider} />
          <SwitchRow
            label="Maîtrise des champions"
            description="Top 3 champions avec niveau et points"
            value={homeConfig.showMasteries}
            onValueChange={v => updateHomeConfig({ showMasteries: v })}
          />
          <View style={styles.switchDivider} />
          <SwitchRow
            label="Performance récente"
            description="KDA, CS/min et vision sur les 7 dernières parties"
            value={homeConfig.showRecentPerf}
            onValueChange={v => updateHomeConfig({ showRecentPerf: v })}
          />
        </View>

        {/* ── Clear config ─────────────────────────────────────────────── */}
        {storedConfig && (
          <TouchableOpacity style={styles.btnClear} onPress={clearConfig}>
            <Text style={styles.btnClearLabel}>Supprimer le compte enregistré</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: LoL.bgHighlight, true: LoL.goldDeep }}
        thumbColor={value ? LoL.gold : LoL.textMuted}
        ios_backgroundColor={LoL.bgHighlight}
      />
    </View>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{children}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
  },
  scroll: {
    padding: Spacing.lg,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: LoL.goldDark,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: LoL.textSecondary,
    letterSpacing: 1.5,
  },

  // Input
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: LoL.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: LoL.textPrimary,
    fontSize: FontSize.md,
  },
  hint: {
    fontSize: FontSize.xs,
    color: LoL.textMuted,
  },

  // Platform chips
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: LoL.bgElevated,
  },
  chipActive: {
    borderColor: LoL.gold,
    backgroundColor: LoL.goldDeep,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: LoL.textSecondary,
    letterSpacing: 0.5,
  },
  chipLabelActive: {
    color: LoL.gold,
  },

  // Buttons
  btnGold: {
    backgroundColor: LoL.gold,
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnGoldLabel: {
    color: LoL.bg,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  btnClear: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  btnClearLabel: {
    color: LoL.loss,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Switch group
  switchGroup: {
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  switchText: {
    flex: 1,
    gap: 3,
  },
  switchLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: LoL.textPrimary,
  },
  switchDesc: {
    fontSize: FontSize.xs,
    color: LoL.textSecondary,
    lineHeight: 16,
  },
  switchDivider: {
    height: 1,
    backgroundColor: LoL.goldDeep,
    marginHorizontal: Spacing.md,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(198, 72, 60, 0.12)',
    borderWidth: 1,
    borderColor: LoL.loss,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: LoL.loss,
    fontSize: FontSize.sm,
  },

  // Preview card
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.gold,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: LoL.gold,
  },
  previewInfo: {
    flex: 1,
    gap: 3,
  },
  previewName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: LoL.goldLight,
  },
  previewTag: {
    fontSize: FontSize.md,
    fontWeight: '400',
    color: LoL.textSecondary,
  },
  previewLevel: {
    fontSize: FontSize.sm,
    color: LoL.textSecondary,
  },
  previewRegion: {
    fontSize: FontSize.xs,
    color: LoL.textMuted,
    letterSpacing: 0.5,
  },
});
