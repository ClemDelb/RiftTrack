import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme';
import { ParticipantDto } from '@/services/riot-api';
import { getCurrentMatch } from '@/services/match-store';
import { DDragon } from '@/services/ddragon';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDmg(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function formatCs(p: ParticipantDto, gameDuration: number): string {
  const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
  const csMin = (cs / (gameDuration / 60)).toFixed(1);
  return `${cs} (${csMin})`;
}

const QUEUE_LABELS: Record<number, string> = {
  420: 'Ranked Solo', 440: 'Ranked Flex', 450: 'ARAM',
  400: 'Normal Draft', 430: 'Normal', 490: 'Quickplay',
  900: 'URF', 1020: 'One for All', 0: 'Custom',
};

const POSITION_LABELS: Record<string, string> = {
  TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid',
  BOTTOM: 'Bot', UTILITY: 'Support',
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const { match, puuid } = getCurrentMatch();

  const { team100, team200, maxDmg, myChamp, win } = useMemo(() => {
    if (!match) return { team100: [], team200: [], maxDmg: 1, myChamp: '', win: false };
    const all = match.info.participants;
    const maxDmg = Math.max(...all.map(p => p.totalDamageDealtToChampions), 1);
    const me = all.find(p => p.puuid === puuid);
    return {
      team100:  all.filter(p => p.teamId === 100),
      team200:  all.filter(p => p.teamId === 200),
      maxDmg,
      myChamp:  me?.championName ?? '',
      win:      me?.win ?? false,
    };
  }, [match, puuid]);

  if (!match) return null;

  const team100Win = team100[0]?.win ?? false;

  return (
    <View style={styles.root}>
      {/* ── Hero background ─────────────────────────────────────────────── */}
      {myChamp ? (
        <>
          <Image
            source={{ uri: DDragon.splash(myChamp) }}
            style={[styles.heroBg, { height: 160 + insets.top }]}
            contentFit="cover"
          />
          <View style={[styles.heroBgOverlay, { height: 160 + insets.top }]} />
        </>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>

        {/* ── Match header ────────────────────────────────────────────────── */}
        <View style={[styles.matchHeader, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.matchQueue}>
            {QUEUE_LABELS[match.info.queueId] ?? 'Partie'}
          </Text>
          <Text style={styles.matchDuration}>
            {formatDuration(match.info.gameDuration)}
          </Text>
          <View style={[styles.matchResult, { backgroundColor: win ? LoL.win : LoL.loss }]}>
            <Text style={styles.matchResultText}>{win ? 'VICTOIRE' : 'DÉFAITE'}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Team 100 ──────────────────────────────────────────────────── */}
          <TeamSection
            label="ÉQUIPE BLEUE"
            win={team100Win}
            color={LoL.hextech}
            participants={team100}
            myPuuid={puuid}
            maxDmg={maxDmg}
            gameDuration={match.info.gameDuration}
          />

          {/* ── Team 200 ──────────────────────────────────────────────────── */}
          <TeamSection
            label="ÉQUIPE ROUGE"
            win={!team100Win}
            color={LoL.loss}
            participants={team200}
            myPuuid={puuid}
            maxDmg={maxDmg}
            gameDuration={match.info.gameDuration}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Team section ──────────────────────────────────────────────────────────────

function TeamSection({
  label, win, color, participants, myPuuid, maxDmg, gameDuration,
}: {
  label: string;
  win: boolean;
  color: string;
  participants: ParticipantDto[];
  myPuuid: string;
  maxDmg: number;
  gameDuration: number;
}) {
  return (
    <View style={styles.teamSection}>
      {/* Team header */}
      <View style={[styles.teamHeader, { borderLeftColor: color }]}>
        <Text style={[styles.teamLabel, { color }]}>{label}</Text>
        <View style={[styles.teamResultBadge, { backgroundColor: win ? LoL.win : LoL.loss }]}>
          <Text style={styles.teamResultText}>{win ? 'VICTOIRE' : 'DÉFAITE'}</Text>
        </View>
      </View>

      {/* Players */}
      <View style={styles.teamPlayers}>
        {participants.map((p, i) => (
          <React.Fragment key={p.puuid}>
            <PlayerRow
              participant={p}
              isMe={p.puuid === myPuuid}
              accentColor={color}
              maxDmg={maxDmg}
              gameDuration={gameDuration}
            />
            {i < participants.length - 1 && <View style={styles.playerDivider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────

function PlayerRow({
  participant: p, isMe, accentColor, maxDmg, gameDuration,
}: {
  participant: ParticipantDto;
  isMe: boolean;
  accentColor: string;
  maxDmg: number;
  gameDuration: number;
}) {
  const dmgPct  = p.totalDamageDealtToChampions / maxDmg;
  const kda     = ((p.kills + p.assists) / Math.max(p.deaths, 1)).toFixed(1);
  const items   = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
  const pos     = POSITION_LABELS[p.teamPosition] ?? '';
  const name    = p.riotIdGameName || p.championName;

  return (
    <View style={[styles.playerRow, isMe && styles.playerRowMe]}>
      {/* Left accent for "me" */}
      {isMe && <View style={[styles.meAccent, { backgroundColor: accentColor }]} />}

      {/* Champion tile */}
      <View>
        <Image
          source={{ uri: DDragon.tile(p.championName) }}
          style={[styles.champTile, isMe && { borderColor: accentColor }]}
          contentFit="cover"
        />
        {pos ? (
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>{pos}</Text>
          </View>
        ) : null}
      </View>

      {/* Main content */}
      <View style={styles.playerMain}>

        {/* Top line: name + KDA */}
        <View style={styles.playerTopLine}>
          <Text style={[styles.playerName, isMe && { color: LoL.gold }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.kdaRow}>
            <Text style={styles.kdaKill}>{p.kills}</Text>
            <Text style={styles.kdaSlash}>/</Text>
            <Text style={styles.kdaDeath}>{p.deaths}</Text>
            <Text style={styles.kdaSlash}>/</Text>
            <Text style={styles.kdaAssist}>{p.assists}</Text>
            <Text style={styles.kdaRatio}> · {kda}</Text>
          </View>
        </View>

        {/* CS + damage */}
        <View style={styles.playerMidLine}>
          <Text style={styles.csText}>{formatCs(p, gameDuration)} CS</Text>
          <View style={styles.dmgContainer}>
            <View style={[styles.dmgBar, { width: `${Math.round(dmgPct * 100)}%` as any, backgroundColor: accentColor }]} />
            <Text style={styles.dmgText}>{formatDmg(p.totalDamageDealtToChampions)}</Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.itemsRow}>
          {items.map((id, i) => (
            <SmallItem key={i} itemId={id} />
          ))}
          <View style={{ width: 4 }} />
          <SmallItem itemId={p.item6} trinket />
        </View>
      </View>
    </View>
  );
}

// ── Small item ─────────────────────────────────────────────────────────────────

function SmallItem({ itemId, trinket }: { itemId: number; trinket?: boolean }) {
  // version is stored in DDragon cache — use a placeholder for missing items
  const [version, setVersion] = React.useState('');
  React.useEffect(() => {
    import('@/services/ddragon').then(m => m.getLatestVersion().then(setVersion));
  }, []);

  const size = trinket ? 22 : 24;
  const br   = trinket ? size / 2 : Radius.sm;
  if (!itemId || !version) {
    return <View style={[styles.itemEmpty, { width: size, height: size, borderRadius: br }]} />;
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
  root: { flex: 1, backgroundColor: LoL.bgSurface },

  // Hero bg
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroBgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(1, 10, 19, 0.82)',
  },

  scroll: { flex: 1 },

  // Match header
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  matchQueue: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '800',
    color: LoL.goldLight,
    letterSpacing: 0.5,
  },
  matchDuration: {
    fontSize: FontSize.sm,
    color: LoL.textSecondary,
    fontWeight: '600',
  },
  matchResult: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  matchResultText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.bg,
    letterSpacing: 0.8,
  },

  body: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },

  // Team section
  teamSection: {
    backgroundColor: LoL.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LoL.goldDark,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: LoL.bg,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: LoL.goldDark,
  },
  teamLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  teamResultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  teamResultText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: LoL.bg,
    letterSpacing: 0.8,
  },

  teamPlayers: {},
  playerDivider: { height: 1, backgroundColor: LoL.goldDeep },

  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playerRowMe: {
    backgroundColor: 'rgba(200, 170, 110, 0.06)',
  },
  meAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },

  // Champion tile
  champTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: LoL.goldDark,
  },
  positionBadge: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  positionText: {
    fontSize: 8,
    fontWeight: '800',
    color: LoL.textMuted,
    backgroundColor: LoL.bg,
    paddingHorizontal: 3,
    borderRadius: 2,
    letterSpacing: 0.3,
    overflow: 'hidden',
  },

  // Player main block
  playerMain: { flex: 1, gap: 4 },
  playerTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: LoL.textPrimary,
  },
  kdaRow: { flexDirection: 'row', alignItems: 'center' },
  kdaKill:   { fontSize: FontSize.sm, fontWeight: '800', color: LoL.textPrimary },
  kdaDeath:  { fontSize: FontSize.sm, fontWeight: '800', color: LoL.loss },
  kdaAssist: { fontSize: FontSize.sm, fontWeight: '800', color: LoL.textSecondary },
  kdaSlash:  { fontSize: FontSize.sm, color: LoL.textMuted },
  kdaRatio:  { fontSize: FontSize.xs, color: LoL.textMuted },

  // CS + damage
  playerMidLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  csText: {
    fontSize: FontSize.xs,
    color: LoL.textSecondary,
    minWidth: 72,
  },
  dmgContainer: {
    flex: 1,
    height: 16,
    backgroundColor: LoL.bg,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  dmgBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
    borderRadius: Radius.sm,
  },
  dmgText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: LoL.textPrimary,
    paddingHorizontal: 4,
  },

  // Items
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  itemIcon: { borderWidth: 1, borderColor: LoL.goldDark },
  itemEmpty: {
    backgroundColor: LoL.bg,
    borderWidth: 1,
    borderColor: LoL.goldDeep,
  },
});
