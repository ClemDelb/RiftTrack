import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getRankedEntries,
  getTopMasteries,
  getRecentMatchIds,
  getMatch,
} from '@/services/riot-api';
import { championById, DDragon } from '@/services/ddragon';

const STORAGE_KEY = '@rifttrack/summoner_config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredConfig {
  gameName: string;
  tagLine: string;
  platform: string;
  puuid: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface ChampStat {
  id: string;          // DDragon key, e.g. "AurelionSol"
  name: string;
  masteryLevel: number;
  masteryPoints: number;
}

export interface RecentPerf {
  kills: number;
  deaths: number;
  assists: number;
  csPerMin: number;
  visionScore: number;
  games: number;
}

export interface SoloQueueStats {
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface SummonerProfile {
  gameName: string;
  tagLine: string;
  platform: string;
  level: number;
  profileIconId: number;
  topSoloChamp: string;  // DDragon key used for the hero background
  soloQueue: SoloQueueStats | null;
  flexQueue: SoloQueueStats | null;
  topChampions: ChampStat[];
  recentPerf: RecentPerf | null;
}

interface SummonerContextType {
  profile: SummonerProfile | null;
  storedConfig: StoredConfig | null;
  profileLoading: boolean;
  profileError: string | null;
  saveConfig: (config: StoredConfig) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearConfig: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const SummonerContext = createContext<SummonerContextType | null>(null);

export function SummonerProvider({ children }: { children: React.ReactNode }) {
  const [storedConfig, setStoredConfig] = useState<StoredConfig | null>(null);
  const [profile, setProfile]           = useState<SummonerProfile | null>(null);
  const [profileLoading, setLoading]    = useState(false);
  const [profileError, setError]        = useState<string | null>(null);

  // Keep a ref so `refreshProfile` always has the latest config without deps
  const configRef = useRef(storedConfig);
  configRef.current = storedConfig;

  const loadProfileFromConfig = useCallback(async (config: StoredConfig) => {
    setLoading(true);
    setError(null);
    try {
      // ① Ranked + masteries in parallel
      const [ranked, masteries] = await Promise.all([
        getRankedEntries(config.puuid, config.platform),
        getTopMasteries(config.puuid, config.platform, 3),
      ]);

      // ② Map championId (number) → DDragon key + name
      const topChampions: ChampStat[] = await Promise.all(
        masteries.map(async m => {
          const champ = await championById(m.championId);
          return {
            id:            champ?.id   ?? String(m.championId),
            name:          champ?.name ?? `Champion #${m.championId}`,
            masteryLevel:  m.championLevel,
            masteryPoints: m.championPoints,
          };
        })
      );

      // ③ Recent ranked matches (non-blocking — recentPerf stays null on failure)
      let recentPerf: RecentPerf | null = null;
      try {
        const matchIds = await getRecentMatchIds(config.puuid, config.platform, 7);
        if (matchIds.length > 0) {
          const matches = await Promise.all(
            matchIds.map(id => getMatch(id, config.platform))
          );
          type MatchStat = {
            kills: number; deaths: number; assists: number;
            csPerMin: number; visionScore: number;
          };
          const stats: MatchStat[] = matches.flatMap(match => {
            const p = match.info.participants.find(p => p.puuid === config.puuid);
            if (!p) return [];
            const mins = match.info.gameDuration / 60;
            return [{
              kills:       p.kills,
              deaths:      p.deaths,
              assists:     p.assists,
              csPerMin:    (p.totalMinionsKilled + p.neutralMinionsKilled) / mins,
              visionScore: p.visionScore,
            }];
          });

          if (stats.length > 0) {
            const avg = (key: keyof MatchStat) =>
              parseFloat(
                (stats.reduce((s, m) => s + m[key], 0) / stats.length).toFixed(1)
              );
            recentPerf = {
              kills:       avg('kills'),
              deaths:      avg('deaths'),
              assists:     avg('assists'),
              csPerMin:    avg('csPerMin'),
              visionScore: avg('visionScore'),
              games:       stats.length,
            };
          }
        }
      } catch {
        // recentPerf stays null — don't block the rest
      }

      const soloEntry = ranked.find(e => e.queueType === 'RANKED_SOLO_5x5') ?? null;
      const flexEntry = ranked.find(e => e.queueType === 'RANKED_FLEX_SR') ?? null;

      const toQueueStats = (e: typeof soloEntry): SoloQueueStats | null =>
        e ? { tier: e.tier, rank: e.rank, lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;

      setProfile({
        gameName:      config.gameName,
        tagLine:       config.tagLine,
        platform:      config.platform,
        level:         config.summonerLevel,
        profileIconId: config.profileIconId,
        topSoloChamp:  topChampions[0]?.id ?? 'Lux',
        soloQueue:     toQueueStats(soloEntry),
        flexQueue:     toQueueStats(flexEntry),
        topChampions,
        recentPerf,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on app start if a config is persisted
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async raw => {
        if (!raw) return;
        const config = JSON.parse(raw) as StoredConfig;
        if (!config.puuid) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
        setStoredConfig(config);
        loadProfileFromConfig(config);
      })
      .catch(console.error);
  }, [loadProfileFromConfig]);

  const saveConfig = useCallback(
    async (config: StoredConfig) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setStoredConfig(config);
      await loadProfileFromConfig(config);
    },
    [loadProfileFromConfig]
  );

  const refreshProfile = useCallback(async () => {
    if (configRef.current) await loadProfileFromConfig(configRef.current);
  }, [loadProfileFromConfig]);

  const clearConfig = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setStoredConfig(null);
    setProfile(null);
  }, []);

  return (
    <SummonerContext.Provider
      value={{
        profile,
        storedConfig,
        profileLoading,
        profileError,
        saveConfig,
        refreshProfile,
        clearConfig,
      }}>
      {children}
    </SummonerContext.Provider>
  );
}

export function useSummoner() {
  const ctx = useContext(SummonerContext);
  if (!ctx) throw new Error('useSummoner must be inside SummonerProvider');
  return ctx;
}
