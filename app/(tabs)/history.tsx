import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setCurrentMatch } from '@/services/match-store';

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useSummoner } from '@/contexts/summoner';
import { useRefreshGuard } from '@/hooks/use-refresh-guard'
import { getMatchHistory, getMatch, MatchDto, ParticipantDto } from '@/services/riot-api';
import { DDragon, getLatestVersion } from '@/services/ddragon';

// ── Cache ─────────────────────────────────────────────────────────────────────

type CacheEntry = { entries: MatchEntry[]; version: string; ts: number };
const historyCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Batch fetcher ─────────────────────────────────────────────────────────────

async function fetchBatched<T>(
  ids: string[],
  fetcher: (id: string) => Promise<T>,
  batchSize = 4,
  delayMs = 350,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(fetcher)));
    if (i + batchSize < ids.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

// ── Queue labels ──────────────────────────────────────────────────────────────

const QUEUE_LABELS: Record<number, string> = {
  420:  'Ranked Solo',
  440:  'Ranked Flex',
  450:  'ARAM',
  400:  'Normal Draft',
  430:  'Normal',
  490:  'Quickplay',
  900:  'URF',
  1020: 'One for All',
  1300: 'Nexus Blitz',
  1400: 'Ultimate Spellbook',
  76:   'URF',
  0:    'Custom',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor(diff / 60_000);
  if (days > 0)  return `${days}j`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getMultiKill(p: ParticipantDto): { label: string; color: string } | null {
  if (p.pentaKills  > 0) return { label: 'PENTA KILL',  color: '#FF4655' };
  if (p.quadraKills > 0) return { label: 'QUADRA KILL', color: LoL.gold   };
  if (p.tripleKills > 0) return { label: 'TRIPLE KILL', color: LoL.gold   };
  if (p.doubleKills > 0) return { label: 'DOUBLE KILL', color: LoL.textSecondary };
  return null;
}

function kdaColor(ratio: number): string {
  if (ratio >= 5) return LoL.win;
  if (ratio >= 3) return LoL.gold;
  return LoL.textSecondary;
}

function formatDmg(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MatchEntry = {
  matchId: string;
  match: MatchDto;
  participant: ParticipantDto;
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { storedConfig } = useSummoner();
    const guard = useRefreshGuard('history')

  const [entries,    setEntries]    = useState<MatchEntry[]>([]);
  const [version,    setVersion]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (!storedConfig) return;

    // Serve from cache unless it's a manual refresh or cache is stale
    const cacheKey = storedConfig.puuid;
    if (!isRefresh) {
      const cached = historyCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setEntries(cached.entries);
        setVersion(cached.version);
        return;
      }
    }

    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [v, ids] = await Promise.all([
        getLatestVersion(),
        getMatchHistory(storedConfig.puuid, storedConfig.platform, 15),
      ]);
      setVersion(v);

      // Fetch in batches of 4 with 350ms between batches to stay under rate limit
      const matches = await fetchBatched(
        ids,
        id => getMatch(id, storedConfig.platform),
        4,
        350,
      );

      const result: MatchEntry[] = matches
        .map((match, i) => ({
          matchId: ids[i],
          match,
          participant: match.info.participants.find(p => p.puuid === storedConfig.puuid)!,
        }))
        .filter(e => e.participant != null);

      setEntries(result);
      historyCache.set(cacheKey, { entries: result, version: v, ts: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storedConfig]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── No account ──────────────────────────────────────────────────────────────

  if (!storedConfig) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
          <IconSymbol name="person.fill" size={56} color={LoL.goldDark} />
        <Text style={styles.emptyTitle}>Aucun compte configuré</Text>
        <Text style={styles.emptySubtitle}>
            Renseigne ton Riot ID pour voir tes statistiques
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/settings')}>
          <Text style={styles.btnLabel}>CONFIGURER MON COMPTE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={LoL.gold} size="large" />
        <Text style={styles.loadingText}>Chargement de l'historique…</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Erreur</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => fetchHistory()}>
          <Text style={styles.btnLabel}>RÉESSAYER</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      data={entries}
      keyExtractor={e => e.matchId}
      renderItem={({ item }) => <MatchCard entry={item} version={version} />}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      ListHeaderComponent={
        <View style={[styles.listHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLine} />
          <Text style={styles.listTitle}>HISTORIQUE</Text>
          <View style={styles.headerLine} />
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptySubtitle}>Aucune partie trouvée</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
              if (guard()) fetchHistory(true)
          }}
          tintColor={LoL.gold}
          colors={[LoL.gold]}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Match card ─────────────────────────────────────────────────────────────────

function MatchCard({ entry, version }: { entry: MatchEntry; version: string }) {
  const { match, participant: p } = entry;
  const win         = p.win;
  const accent      = win ? LoL.win : LoL.loss;
  const cs          = p.totalMinionsKilled + p.neutralMinionsKilled;
  const mins        = match.info.gameDuration / 60;
  const csPerMin    = (cs / mins).toFixed(1);
  const kdaRatio    = (p.kills + p.assists) / Math.max(p.deaths, 1);
  const multiKill   = getMultiKill(p);
  const queueLabel  = QUEUE_LABELS[match.info.queueId] ?? 'Partie';
  const items       = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];

  const handlePress = () => {
    setCurrentMatch(match, p.puuid);
    router.push('/match-detail');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[styles.card, { borderLeftColor: accent }]}>

      {/* Champion splash — subtle background */}
      <Image
        source={{ uri: DDragon.splash(p.championName) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[
        styles.cardOverlay,
        { backgroundColor: win ? 'rgba(1, 18, 18, 0.94)' : 'rgba(18, 3, 3, 0.94)' },
      ]} />

      <View style={styles.cardInner}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: DDragon.tile(p.championName) }}
            style={[styles.champTile, { borderColor: accent }]}
            contentFit="cover"
          />
          <View style={styles.headerMid}>
            <Text style={styles.champName}>{p.championName}</Text>
            <Text style={styles.headerMeta}>
              {queueLabel}
              <Text style={styles.headerMetaDim}> · {formatDuration(match.info.gameDuration)}</Text>
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.resultBadge, { backgroundColor: accent }]}>
              <Text style={styles.resultBadgeText}>{win ? 'VICTOIRE' : 'DÉFAITE'}</Text>
            </View>
            <Text style={styles.timeAgoText}>{timeAgo(match.info.gameEndTimestamp)}</Text>
          </View>
        </View>

        <View style={styles.sep} />

        {/* ── KDA + stats ────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {/* KDA */}
          <View style={styles.kdaBlock}>
            <View style={styles.kdaNumbers}>
              <Text style={styles.kdaKill}>{p.kills}</Text>
              <Text style={styles.kdaSlash}>/</Text>
              <Text style={styles.kdaDeath}>{p.deaths}</Text>
              <Text style={styles.kdaSlash}>/</Text>
              <Text style={styles.kdaAssist}>{p.assists}</Text>
            </View>
            <Text style={[styles.kdaRatio, { color: kdaColor(kdaRatio) }]}>
              {kdaRatio.toFixed(2)} KDA
            </Text>
          </View>

          <View style={styles.vertDivider} />

          {/* Secondary stats */}
          <View style={styles.secondaryStats}>
            <MiniStat icon="⚔" label="CS" value={String(cs)} sub={`${csPerMin}/min`} />
            <MiniStat icon="👁" label="Vision" value={String(p.visionScore)} />
            <MiniStat icon="💥" label="Dégâts" value={formatDmg(p.totalDamageDealtToChampions)} />
          </View>
        </View>

        <View style={styles.sep} />

        {/* ── Items + multi-kill ─────────────────────────────────────────── */}
        <View style={styles.bottomRow}>
          <View style={styles.itemsGroup}>
            {items.map((id, i) => (
              <ItemSlot key={i} itemId={id} version={version} />
            ))}
            <View style={styles.trinketGap} />
            <ItemSlot itemId={p.item6} version={version} trinket />
          </View>

          {multiKill && (
            <View style={[styles.multiKillBadge, { borderColor: multiKill.color }]}>
              <Text style={[styles.multiKillText, { color: multiKill.color }]}>
                {multiKill.label}
              </Text>
            </View>
          )}
        </View>

      </View>
    </TouchableOpacity>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, sub,
}: { icon?: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
      {sub && <Text style={styles.miniStatSub}>{sub}</Text>}
    </View>
  );
}

function ItemSlot({ itemId, version, trinket }: { itemId: number; version: string; trinket?: boolean }) {
  const size = trinket ? 28 : 30;
  const br   = trinket ? size / 2 : Radius.sm;
  if (!itemId || !version) {
    return (
      <View style={[styles.itemEmpty, { width: size, height: size, borderRadius: br }]} />
    );
  }
  return (
    <Image
      source={{ uri: DDragon.item(version, itemId) }}
      style={[styles.itemIcon, { width: size, height: size, borderRadius: br }]}
      contentFit="cover"
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
  },
  list: {
    paddingHorizontal: Spacing.md,
  },

  // List header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerLine: { flex: 1, height: 1, backgroundColor: LoL.goldDark },
  listTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.gold,
    letterSpacing: 3,
  },

  // Centered states
  centered: {
    flex: 1,
    backgroundColor: LoL.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: { color: LoL.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: LoL.goldLight, textAlign: 'center' },
  emptySubtitle: { fontSize: FontSize.sm, color: LoL.textSecondary, textAlign: 'center', lineHeight: 20 },
  btn: {
    backgroundColor: LoL.gold,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  btnLabel: { color: LoL.bg, fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 1.5 },

  // Card shell
  card: {
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    overflow: 'hidden',
    backgroundColor: LoL.bgElevated,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardInner: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  champTile: {
    width: 54,
    height: 54,
    borderRadius: Radius.sm,
    borderWidth: 2,
  },
  headerMid: { flex: 1, gap: 4 },
  champName: {
    fontSize: FontSize.base,
    fontWeight: '800',
    color: LoL.goldLight,
  },
  headerMeta: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: LoL.textSecondary,
  },
  headerMetaDim: {
    fontWeight: '400',
    color: LoL.textMuted,
  },
  headerRight: { alignItems: 'flex-end', gap: 5 },
  resultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  resultBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.bg,
    letterSpacing: 0.8,
  },
  timeAgoText: { fontSize: FontSize.xs, color: LoL.textMuted },

  // Separator
  sep: { height: 1, backgroundColor: LoL.goldDeep },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  kdaBlock: { gap: 3, minWidth: 80 },
  kdaNumbers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kdaKill:   { fontSize: FontSize.lg, fontWeight: '800', color: LoL.textPrimary },
  kdaDeath:  { fontSize: FontSize.lg, fontWeight: '800', color: LoL.loss },
  kdaAssist: { fontSize: FontSize.lg, fontWeight: '800', color: LoL.textSecondary },
  kdaSlash:  { fontSize: FontSize.md, color: LoL.textMuted, fontWeight: '400' },
  kdaRatio:  { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
  vertDivider: { width: 1, height: 40, backgroundColor: LoL.goldDeep },
  secondaryStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  miniStat: { alignItems: 'center', gap: 2 },
  miniStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LoL.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  miniStatValue: { fontSize: FontSize.sm, fontWeight: '800', color: LoL.textPrimary },
  miniStatSub:   { fontSize: 9, color: LoL.textMuted },

  // Items
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  itemsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trinketGap: { width: 6 },
  itemIcon: {
    borderWidth: 1,
    borderColor: LoL.goldDark,
  },
  itemEmpty: {
    backgroundColor: LoL.bg,
    borderWidth: 1,
    borderColor: LoL.goldDeep,
  },
  multiKillBadge: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  multiKillText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
