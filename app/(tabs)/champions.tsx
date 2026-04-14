import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Collapsible from 'react-native-collapsible';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSummoner } from '@/contexts/summoner';
import {
  getMatchHistory, getMatch, getTopMasteriesAll,
  MasteryDto,
} from '@/services/riot-api';
import { DDragon, championById, formatMastery } from '@/services/ddragon';

// ── Queue config ──────────────────────────────────────────────────────────────

type QueueMode = 'solo' | 'flex';

const QUEUES: { id: QueueMode; label: string; queueId: number }[] = [
  { id: 'solo', label: 'Solo Queue', queueId: 420 },
  { id: 'flex', label: 'Flex Queue', queueId: 440 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ChampionStat = {
  championName: string; // DDragon key
  displayName:  string;
  games:    number;
  wins:     number;
  kills:    number;
  deaths:   number;
  assists:  number;
  cs:       number;
  vision:   number;
  damage:   number;
  duration: number; // total seconds
  mastery?: MasteryDto;
};

// ── Cache ─────────────────────────────────────────────────────────────────────

type CacheEntry = { stats: ChampionStat[]; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchBatched<T>(
  ids: string[],
  fetcher: (id: string) => Promise<T>,
  batchSize = 4,
  delayMs   = 350,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    results.push(...await Promise.all(ids.slice(i, i + batchSize).map(fetcher)));
    if (i + batchSize < ids.length) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChampionsScreen() {
  const insets = useSafeAreaInsets();
  const { storedConfig } = useSummoner();

  const [queue,      setQueue]      = useState<QueueMode>('solo');
  const [stats,      setStats]      = useState<ChampionStat[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [dropdown,   setDropdown]   = useState(false);

  const fetchStats = useCallback(async (mode: QueueMode, isRefresh = false) => {
    if (!storedConfig) return;

    const cacheKey = `${storedConfig.puuid}-${mode}`;
    if (!isRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setStats(cached.stats);
        return;
      }
    }

    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const queueId = QUEUES.find(q => q.id === mode)!.queueId;

      const [ids, masteries] = await Promise.all([
        getMatchHistory(storedConfig.puuid, storedConfig.platform, 30, queueId),
        getTopMasteriesAll(storedConfig.puuid, storedConfig.platform, 50),
      ]);

      // Mastery map by championId
      const masteryById = new Map<number, MasteryDto>(
        masteries.map(m => [m.championId, m])
      );

      // Fetch match details in batches
      const matches = await fetchBatched(
        ids,
        id => getMatch(id, storedConfig.platform),
        4, 350,
      );

      // Aggregate stats per champion
      const map = new Map<string, ChampionStat>();

      for (const match of matches) {
        const p = match.info.participants.find(x => x.puuid === storedConfig.puuid);
        if (!p) continue;

        const existing = map.get(p.championName);
        if (existing) {
          existing.games    += 1;
          existing.wins     += p.win ? 1 : 0;
          existing.kills    += p.kills;
          existing.deaths   += p.deaths;
          existing.assists  += p.assists;
          existing.cs       += p.totalMinionsKilled + p.neutralMinionsKilled;
          existing.vision   += p.visionScore;
          existing.damage   += p.totalDamageDealtToChampions;
          existing.duration += match.info.gameDuration;
        } else {
          map.set(p.championName, {
            championName: p.championName,
            displayName:  p.championName,
            games:    1,
            wins:     p.win ? 1 : 0,
            kills:    p.kills,
            deaths:   p.deaths,
            assists:  p.assists,
            cs:       p.totalMinionsKilled + p.neutralMinionsKilled,
            vision:   p.visionScore,
            damage:   p.totalDamageDealtToChampions,
            duration: match.info.gameDuration,
          });
        }
      }

      // Build DDragon id → mastery map (loads champion data once, then cached)
      const champMasteryMap = new Map<string, MasteryDto>();
      for (const m of masteries) {
        const champData = await championById(m.championId);
        if (champData) champMasteryMap.set(champData.id, m);
      }

      const statsWithMastery: ChampionStat[] = Array.from(map.values()).map(s => ({
        ...s,
        mastery: champMasteryMap.get(s.championName),
      }));

      // Sort by games desc
      statsWithMastery.sort((a, b) => b.games - a.games);

      setStats(statsWithMastery);
      cache.set(cacheKey, { stats: statsWithMastery, ts: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storedConfig]);

  useEffect(() => { fetchStats(queue); }, [queue, fetchStats]);

  // ── No account ──────────────────────────────────────────────────────────────

  if (!storedConfig) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Aucun compte configuré</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/settings')}>
          <Text style={styles.btnLabel}>CONFIGURER MON COMPTE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeQueue = QUEUES.find(q => q.id === queue)!;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header + dropdown ─────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.headerRow}>
          <View style={styles.headerLine} />
          <Text style={styles.headerTitle}>CHAMPIONS</Text>
          <View style={styles.headerLine} />
        </View>

        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setDropdown(true)}
          activeOpacity={0.8}>
          <Text style={styles.dropdownBtnText}>{activeQueue.label}</Text>
          <IconSymbol name="chevron.down" size={14} color={LoL.gold} />
        </TouchableOpacity>
      </View>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={LoL.gold} size="large" />
          <Text style={styles.loadingText}>Analyse des parties…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Erreur</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => fetchStats(queue)}>
            <Text style={styles.btnLabel}>RÉESSAYER</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stats}
          keyExtractor={s => s.championName}
          renderItem={({ item, index }) => (
            <ChampionCard stat={item} rank={index + 1} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptySubtitle}>
                Aucune partie classée trouvée sur les 30 dernières
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchStats(queue, true)}
              tintColor={LoL.gold}
              colors={[LoL.gold]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Dropdown modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={dropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdown(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setDropdown(false)}>
          <View style={[styles.dropdownList, { marginTop: insets.top + 96 }]}>
            {QUEUES.map(q => (
              <TouchableOpacity
                key={q.id}
                style={[styles.dropdownItem, q.id === queue && styles.dropdownItemActive]}
                onPress={() => { setQueue(q.id); setDropdown(false); }}
                activeOpacity={0.7}>
                <Text style={[styles.dropdownItemText, q.id === queue && { color: LoL.gold }]}>
                  {q.label}
                </Text>
                {q.id === queue && (
                  <IconSymbol name="checkmark" size={14} color={LoL.gold} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ── Champion card ─────────────────────────────────────────────────────────────

function ChampionCard({ stat: s, rank }: { stat: ChampionStat; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  const winRate    = Math.round((s.wins / s.games) * 100);
  const avgKills   = (s.kills   / s.games).toFixed(1);
  const avgDeaths  = (s.deaths  / s.games).toFixed(1);
  const avgAssists = (s.assists / s.games).toFixed(1);
  const kda        = ((s.kills + s.assists) / Math.max(s.deaths, 1)).toFixed(2);
  const csPerMin   = (s.cs / (s.duration / 60)).toFixed(1);
  const avgVision  = Math.round(s.vision  / s.games);
  const avgDmg     = Math.round(s.damage  / s.games);
  const wrColor    = winRate >= 55 ? LoL.win : winRate >= 50 ? LoL.gold : LoL.loss;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.9}>
      {/* Champion splash background */}
      <Image
        source={{ uri: DDragon.splash(s.championName) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={styles.cardOverlay} />

      <View style={styles.cardContent}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardRank}>#{rank}</Text>
          <Image
            source={{ uri: DDragon.tile(s.championName) }}
            style={styles.champTile}
            contentFit="cover"
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.champName}>{s.displayName}</Text>
            <Text style={styles.champGames}>{s.games} partie{s.games > 1 ? 's' : ''}</Text>
          </View>

          {/* Winrate badge */}
          <View style={[styles.wrBadge, { borderColor: wrColor }]}>
            <Text style={[styles.wrValue, { color: wrColor }]}>{winRate}%</Text>
            <Text style={styles.wrLabel}>winrate</Text>
          </View>
        </View>

        {/* ── W/L bar ─────────────────────────────────────────────────── */}
        <View style={styles.wlBar}>
          <View style={[styles.wlSegment, { flex: s.wins,           backgroundColor: LoL.win  }]} />
          <View style={[styles.wlSegment, { flex: s.games - s.wins, backgroundColor: LoL.loss }]} />
        </View>
        <View style={styles.wlLabels}>
          <Text style={[styles.wlCount, { color: LoL.win }]}>{s.wins}V</Text>
          <Text style={[styles.wlCount, { color: LoL.loss }]}>{s.games - s.wins}D</Text>
        </View>

        {/* ── Collapsible toggle indicator ────────────────────────────── */}
        <View style={styles.collapseToggle}>
          <View style={styles.collapseToggleLine} />
          <Text style={styles.collapseToggleLabel}>STATS</Text>
          <IconSymbol
            name="chevron.right"
            size={12}
            color={LoL.textMuted}
            style={{ transform: [{ rotate: expanded ? '270deg' : '90deg' }] }}
          />
          <View style={styles.collapseToggleLine} />
        </View>

        {/* ── Stats grid (collapsible avec animation) ──────────────────── */}
        <Collapsible collapsed={!expanded} align="top">
          <View style={styles.statsGrid}>
            <StatCol label="KDA" value={kda} sub={`${avgKills} / ${avgDeaths} / ${avgAssists}`} highlight />
            <View style={styles.gridDivider} />
            <StatCol label="CS/min" value={csPerMin} sub={`${Math.round(s.cs / s.games)} total`} />
            <View style={styles.gridDivider} />
            <StatCol label="Vision" value={String(avgVision)} sub="moy. / partie" />
            <View style={styles.gridDivider} />
            <StatCol label="Dégâts" value={fmtDmg(avgDmg)} sub="moy. / partie" />
          </View>

          {/* ── Mastery ───────────────────────────────────────────────── */}
          {s.mastery && (
            <>
              <View style={styles.sep} />
              <View style={styles.masteryRow}>
                <View style={[styles.masteryLevelBadge, masteryColor(s.mastery.championLevel)]}>
                  <Text style={styles.masteryLevelText}>M{s.mastery.championLevel}</Text>
                </View>
                <Text style={styles.masteryPoints}>
                  {formatMastery(s.mastery.championPoints)} points de maîtrise
                </Text>
              </View>
            </>
          )}
        </Collapsible>

      </View>
    </TouchableOpacity>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCol({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statColLabel}>{label}</Text>
      <Text style={[styles.statColValue, highlight && { color: LoL.gold }]}>{value}</Text>
      <Text style={styles.statColSub}>{sub}</Text>
    </View>
  );
}

function fmtDmg(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function masteryColor(level: number): object {
  if (level >= 10) return { backgroundColor: '#00C853' };
  if (level >= 7)  return { backgroundColor: LoL.gold };
  if (level >= 5)  return { backgroundColor: '#607D8B' };
  return           { backgroundColor: LoL.bgHighlight };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LoL.bgSurface },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: { color: LoL.textSecondary, fontSize: FontSize.sm, marginTop: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: LoL.goldLight },
  emptySubtitle: { fontSize: FontSize.sm, color: LoL.textSecondary, textAlign: 'center' },
  btn: {
    backgroundColor: LoL.gold,
    borderRadius: Radius.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
  },
  btnLabel: { color: LoL.bg, fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 1.5 },

  // Top bar
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerLine: { flex: 1, height: 1, backgroundColor: LoL.goldDark },
  headerTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.gold,
    letterSpacing: 3,
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

  // List
  list: { paddingHorizontal: Spacing.md },

  // Card
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: LoL.bgElevated,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 10, 19, 0.91)',
  },
  cardContent: { padding: Spacing.md, gap: Spacing.sm },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardRank: {
    width: 22,
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.textMuted,
    textAlign: 'center',
  },
  champTile: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: LoL.goldDark,
  },
  cardHeaderInfo: { flex: 1, gap: 3 },
  champName: { fontSize: FontSize.base, fontWeight: '800', color: LoL.goldLight },
  champGames: { fontSize: FontSize.xs, color: LoL.textSecondary },

  // Winrate badge
  wrBadge: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 1,
  },
  wrValue: { fontSize: FontSize.lg, fontWeight: '800' },
  wrLabel: { fontSize: 9, color: LoL.textMuted, letterSpacing: 0.5 },

  // W/L bar
  wlBar: {
    flexDirection: 'row',
    height: 5,
    borderRadius: Radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  wlSegment: { borderRadius: Radius.full },
  wlLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  wlCount: { fontSize: FontSize.xs, fontWeight: '700' },

  // Separator
  sep: { height: 1, backgroundColor: LoL.goldDeep },

  // Collapsible toggle
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  collapseToggleLine: { flex: 1, height: 1, backgroundColor: LoL.goldDeep },
  collapseToggleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: LoL.textMuted,
    letterSpacing: 1.5,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridDivider: { width: 1, height: 36, backgroundColor: LoL.goldDeep },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: LoL.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statColValue: { fontSize: FontSize.sm, fontWeight: '800', color: LoL.textPrimary },
  statColSub: { fontSize: 9, color: LoL.textMuted, textAlign: 'center' },

  // Mastery
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  masteryLevelBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  masteryLevelText: { fontSize: FontSize.xs, fontWeight: '800', color: LoL.bg },
  masteryPoints: { fontSize: FontSize.xs, color: LoL.textSecondary },

  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(1, 10, 19, 0.75)' },
  dropdownList: {
    marginHorizontal: Spacing.lg,
    backgroundColor: LoL.bgElevated,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  dropdownItemActive: { backgroundColor: LoL.goldDeep },
  dropdownItemText: { fontSize: FontSize.sm, fontWeight: '600', color: LoL.textSecondary },
});
