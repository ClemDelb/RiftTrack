import React from 'react'
import {
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { LoL, FontSize, Spacing, Radius } from '@/constants/theme'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useSummoner, SummonerProfile } from '@/contexts/summoner'
import { useHomeConfig } from '@/contexts/home-config'
import { DDragon, formatMastery } from '@/services/ddragon'
import { useRefreshGuard } from '@/hooks/use-refresh-guard'

// ── Rank colors ──────────────────────────────────────────────────────────────

const RANK_COLORS: Record<string, string> = {
    IRON: '#8D8D8D',
    BRONZE: '#B06030',
    SILVER: '#AAAAAA',
    GOLD: '#C8AA6E',
    PLATINUM: '#0AC8B9',
    EMERALD: '#00C853',
    DIAMOND: '#5AC8FA',
    MASTER: '#9D48E0',
    GRANDMASTER: '#E53935',
    CHALLENGER: '#F1C40F',
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ProfilScreen() {
    const insets = useSafeAreaInsets()
    const { profile, profileLoading, profileError, refreshProfile } = useSummoner()
    const { homeConfig } = useHomeConfig()
    const guard = useRefreshGuard('home')

    const handleRefresh = React.useCallback(() => {
        if (guard()) refreshProfile()
    }, [guard, refreshProfile])

    if (profileLoading && !profile) {
        return <LoadingState insetTop={insets.top} />
    }

    if (!profile) {
        return <EmptyState insetTop={insets.top} error={profileError} />
    }

    return (
        <ProfileView
            profile={profile}
            insetTop={insets.top}
            refreshing={profileLoading}
            onRefresh={handleRefresh}
            homeConfig={homeConfig}
        />
    )
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState({ insetTop }: { insetTop: number }) {
    const { t } = useTranslation()
    return (
        <View style={[styles.centeredScreen, { paddingTop: insetTop }]}>
            <SettingsBtn absolute={false} />
            <ActivityIndicator color={LoL.gold} size="large" />
            <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
    )
}

// ── Empty / error state ───────────────────────────────────────────────────────

function EmptyState({ insetTop, error }: { insetTop: number; error: string | null }) {
    const { t } = useTranslation()
    return (
        <View style={[styles.centeredScreen, { paddingTop: insetTop }]}>
            <IconSymbol name="person.fill" size={56} color={LoL.goldDark} />
            <Text style={styles.emptyTitle}>
                {error ? t('profile.errorTitle') : t('common.noAccount.title')}
            </Text>
            <Text style={styles.emptySubtitle}>
                {error ?? t('common.noAccount.subtitle')}
            </Text>
            <TouchableOpacity style={styles.btnConfig} onPress={() => router.push('/settings')}>
                <Text style={styles.btnConfigLabel}>{t('common.noAccount.cta')}</Text>
            </TouchableOpacity>
        </View>
    )
}

// ── Gear button ───────────────────────────────────────────────────────────────

function SettingsBtn({ absolute = true, top }: { absolute?: boolean; top?: number }) {
    const style = absolute
        ? [styles.settingsBtnHero, top !== undefined ? { top } : {}]
        : styles.settingsBtnRelative
    return (
        <TouchableOpacity style={style} onPress={() => router.push('/settings')}>
            <IconSymbol name="gearshape.fill" size={20} color={LoL.gold} />
        </TouchableOpacity>
    )
}

// ── Full profile view ─────────────────────────────────────────────────────────

function ProfileView({
                         profile,
                         insetTop,
                         refreshing,
                         onRefresh,
                         homeConfig,
                     }: {
    profile: SummonerProfile;
    insetTop: number;
    refreshing: boolean;
    onRefresh: () => void;
    homeConfig: import('@/contexts/home-config').HomeConfig;
}) {
    const { t } = useTranslation()
    const { soloQueue, flexQueue, topChampions, recentPerf } = profile
    const rankColor = soloQueue ? (RANK_COLORS[soloQueue.tier] ?? LoL.gold) : LoL.textMuted
    const kdaRatio = recentPerf
        ? ((recentPerf.kills + recentPerf.assists) / Math.max(recentPerf.deaths, 1)).toFixed(1)
        : null

    return (
        <ScrollView
            style={styles.root}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={LoL.gold}
                    colors={[LoL.gold]}
                />
            }>

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <View style={[styles.hero, { paddingTop: insetTop }]}>
                <Image
                    source={{ uri: DDragon.splash(profile.topSoloChamp) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={500}
                />
                <View style={styles.heroOverlayFull} />
                <View style={styles.heroOverlayBottom} />
                <View style={[styles.heroTopBorder, { top: insetTop }]} />

                <SettingsBtn top={insetTop + 12} />

                <View style={styles.heroContent}>
                    {/* Rank pill */}
                    <View style={[styles.rankPill, { borderColor: rankColor }]}>
                        {soloQueue && <View style={[styles.rankDot, { backgroundColor: rankColor }]} />}
                        <Text style={[styles.rankTier, { color: rankColor }]}>
                            {soloQueue?.tier ?? t('profile.unranked')} {soloQueue?.rank}
                        </Text>
                        {soloQueue && (
                            <>
                                <Text style={styles.rankSep}>·</Text>
                                <Text style={[styles.rankDetails, { color: rankColor }]}>
                                    {soloQueue.lp} LP
                                </Text>
                            </>
                        )}
                    </View>

                    <Text style={styles.summonerName}>{profile.gameName}</Text>
                    <Text style={styles.summonerMeta}>
                        {t('profile.meta', { tagLine: profile.tagLine, level: profile.level })}
                    </Text>
                    <Text style={styles.heroChampLabel}>
                        {t('profile.topChamp', { name: topChampions[0]?.name ?? '—' })}
                    </Text>
                </View>
            </View>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <View style={styles.body}>

                {/* Solo Queue */}
                {homeConfig.showSoloQueue && (
                    <>
                        <SectionHeader label={t('profile.soloQueue')} />
                        {soloQueue
                            ? <QueueCard queue={soloQueue} />
                            : <View style={[styles.card, styles.cardEmpty]}>
                                <Text style={styles.emptyCardText}>{t('profile.noSolo')}</Text>
                            </View>
                        }
                    </>
                )}

                {/* Flex Queue */}
                {homeConfig.showFlexQueue && (
                    <>
                        <SectionHeader label={t('profile.flexQueue')} />
                        {flexQueue
                            ? <QueueCard queue={flexQueue} />
                            : <View style={[styles.card, styles.cardEmpty]}>
                                <Text style={styles.emptyCardText}>{t('profile.noFlex')}</Text>
                            </View>
                        }
                    </>
                )}

                {/* Champions */}
                {homeConfig.showMasteries && topChampions.length > 0 && (
                    <>
                        <SectionHeader label={t('profile.masteries')} />
                        <View style={styles.card}>
                            {topChampions.map((champ, i) => (
                                <React.Fragment key={champ.id}>
                                    <View style={styles.champRow}>
                                        <Text style={styles.champRank}>#{i + 1}</Text>
                                        <Image
                                            source={{ uri: DDragon.tile(champ.id) }}
                                            style={styles.champIcon}
                                            contentFit="cover"
                                        />
                                        <View style={styles.champMid}>
                                            <Text style={styles.champName}>{champ.name}</Text>
                                            <Text
                                                style={styles.champSub}>{t('profile.masteryLevel', { level: champ.masteryLevel })}</Text>
                                        </View>
                                        <View style={styles.champRight}>
                                            <Text style={styles.champPts}>{formatMastery(champ.masteryPoints)}</Text>
                                            <Text style={styles.champGames}>{t('profile.masteryPoints')}</Text>
                                        </View>
                                    </View>
                                    {i < topChampions.length - 1 && <View style={styles.rowDivider} />}
                                </React.Fragment>
                            ))}
                        </View>
                    </>
                )}

                {/* Recent perf */}
                {homeConfig.showRecentPerf && (
                    <>
                        <SectionHeader
                            label={recentPerf ? t('profile.recentPerf', { count: recentPerf.games }) : t('profile.recentPerfTitle')}
                        />
                        {recentPerf ? (
                            <View style={styles.card}>
                                <View style={styles.perfGrid}>
                                    <PerfBlock
                                        label={t('profile.kda')}
                                        value={`${recentPerf.kills} / ${recentPerf.deaths} / ${recentPerf.assists}`}
                                        sub={t('profile.kdaRatio', { ratio: kdaRatio })}
                                        highlight
                                    />
                                    <VertDivider tall />
                                    <PerfBlock label={t('profile.csPerMin')} value={String(recentPerf.csPerMin)}
                                               sub={t('profile.csCreeps')} />
                                    <VertDivider tall />
                                    <PerfBlock label={t('profile.vision')} value={String(recentPerf.visionScore)}
                                               sub={t('profile.visionAvg')} />
                                </View>
                            </View>
                        ) : (
                            <View style={[styles.card, styles.cardEmpty]}>
                                <Text style={styles.emptyCardText}>{t('profile.noPerfRecent')}</Text>
                            </View>
                        )}
                    </>
                )}

            </View>
        </ScrollView>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QueueCard({ queue }: { queue: import('@/contexts/summoner').SoloQueueStats }) {
    const { t } = useTranslation()
    const total = queue.wins + queue.losses
    const winRate = Math.round((queue.wins / total) * 100)
    const rankColor = RANK_COLORS[queue.tier] ?? LoL.gold
    const isApex = queue.tier === 'MASTER' || queue.tier === 'GRANDMASTER' || queue.tier === 'CHALLENGER'
    const tierName = queue.tier.charAt(0) + queue.tier.slice(1).toLowerCase()
    const wrColor = winRate >= 50 ? LoL.win : LoL.loss

    return (
        <View style={[styles.queueCard, { borderColor: rankColor }]}>
            {/* Emblem watermark */}
            <Image
                source={{ uri: DDragon.rankEmblem(queue.tier) }}
                style={styles.queueEmblemBg}
                contentFit="contain"
            />

            <View style={styles.queueCardContent}>
                {/* Top row: tier name + emblem */}
                <View style={styles.queueTop}>
                    <Image
                        source={{ uri: DDragon.rankEmblem(queue.tier) }}
                        style={styles.queueEmblem}
                        contentFit="contain"
                    />
                    <View style={styles.queueTopInfo}>
                        <Text style={styles.queueTierBig}>
                            <Text style={{ color: rankColor }}>{tierName}</Text>
                            {!isApex && <Text style={styles.queueRankNum}> {queue.rank}</Text>}
                        </Text>
                        <Text style={styles.queueLpText}>{queue.lp} LP</Text>
                    </View>
                </View>

                {/* W/L split bar */}
                <View style={styles.wlBarTrack}>
                    <View style={[styles.wlBarSegment, { flex: queue.wins, backgroundColor: LoL.win }]} />
                    <View style={[styles.wlBarSegment, { flex: queue.losses, backgroundColor: LoL.loss }]} />
                </View>

                {/* Bottom stats */}
                <View style={styles.queueBottom}>
                    <View style={styles.queueBottomStat}>
                        <Text style={[styles.queueStatBig, { color: LoL.win }]}>{queue.wins}</Text>
                        <Text style={styles.queueStatSmall}>{t('profile.wins')}</Text>
                    </View>
                    <View style={styles.queueBottomCenter}>
                        <Text style={[styles.queueWinRateBig, { color: wrColor }]}>{winRate}%</Text>
                        <Text style={styles.queueStatSmall}>{t('profile.games', { count: total })}</Text>
                    </View>
                    <View style={[styles.queueBottomStat, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.queueStatBig, { color: LoL.loss }]}>{queue.losses}</Text>
                        <Text style={styles.queueStatSmall}>{t('profile.losses')}</Text>
                    </View>
                </View>
            </View>
        </View>
    )
}

function SectionHeader({ label }: { label: string }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionLabel}>{label}</Text>
            <View style={styles.sectionLine} />
        </View>
    )
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <View style={styles.statBlock}>
            <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    )
}

function PerfBlock({
                       label, value, sub, highlight,
                   }: { label: string; value: string; sub: string; highlight?: boolean }) {
    return (
        <View style={styles.perfBlock}>
            <Text style={styles.perfLabel}>{label}</Text>
            <Text style={[styles.perfValue, highlight && { color: LoL.gold }]}>{value}</Text>
            <Text style={styles.perfSub}>{sub}</Text>
        </View>
    )
}

function VertDivider({ tall }: { tall?: boolean }) {
    return <View style={[styles.divider, tall && { height: 56 }]} />
}

// ── Styles ────────────────────────────────────────────────────────────────────

const HERO_HEIGHT = 340

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: LoL.bgSurface,
    },

    // Centered screens
    centeredScreen: {
        flex: 1,
        backgroundColor: LoL.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
        gap: Spacing.md,
    },
    settingsBtnRelative: {
        alignSelf: 'flex-end',
        padding: 8,
        marginBottom: Spacing.md,
    },
    loadingText: {
        color: LoL.textSecondary,
        fontSize: FontSize.sm,
        marginTop: Spacing.sm,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: LoL.goldLight,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: FontSize.sm,
        color: LoL.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    btnConfig: {
        backgroundColor: LoL.gold,
        borderRadius: Radius.sm,
        paddingVertical: 12,
        paddingHorizontal: Spacing.xl,
        marginTop: Spacing.sm,
    },
    btnConfigLabel: {
        color: LoL.bg,
        fontSize: FontSize.sm,
        fontWeight: '800',
        letterSpacing: 1.5,
    },

    // Hero
    hero: {
        height: HERO_HEIGHT,
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    heroOverlayFull: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(1, 10, 19, 0.45)',
    },
    heroOverlayBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180,
        backgroundColor: 'rgba(1, 10, 19, 0.90)',
    },
    heroTopBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: LoL.goldDark,
    },
    settingsBtnHero: {
        position: 'absolute',
        right: Spacing.lg,
        padding: 8,
        backgroundColor: 'rgba(1, 10, 19, 0.55)',
        borderRadius: Radius.full,
    },
    heroContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },

    // Rank pill
    rankPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: Radius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        marginBottom: Spacing.sm,
        gap: 5,
        backgroundColor: 'rgba(1, 10, 19, 0.6)',
    },
    rankDot: { width: 6, height: 6, borderRadius: 3 },
    rankTier: { fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 1.5 },
    rankSep: { color: LoL.textMuted, fontSize: FontSize.xs },
    rankDetails: { fontSize: FontSize.xs, fontWeight: '600' },
    summonerName: {
        fontSize: FontSize.hero,
        fontWeight: '800',
        color: LoL.goldLight,
        letterSpacing: 0.5,
    },
    summonerMeta: { fontSize: FontSize.sm, color: LoL.textSecondary, marginTop: 2 },
    heroChampLabel: { fontSize: FontSize.xs, color: LoL.textMuted, marginTop: Spacing.sm },

    // Body
    body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
        marginBottom: Spacing.xs,
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: LoL.goldDark },
    sectionLabel: {
        fontSize: FontSize.xs,
        fontWeight: '700',
        color: LoL.textSecondary,
        letterSpacing: 1.5,
    },

    // Card
    card: {
        backgroundColor: LoL.bgElevated,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: LoL.goldDark,
        padding: Spacing.lg,
    },
    cardEmpty: { alignItems: 'center', paddingVertical: Spacing.xl },
    emptyCardText: { color: LoL.textMuted, fontSize: FontSize.sm },

    // Queue card
    queueCard: {
        borderRadius: Radius.md,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: LoL.bgElevated,
    },
    queueEmblemBg: {
        position: 'absolute',
        right: -30,
        top: -30,
        width: 200,
        height: 200,
        opacity: 0.06,
    },
    queueCardContent: {
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    queueTop: {
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    queueTopInfo: {
        flex: 1,
        gap: 4,
        justifyContent: 'center',
    },
    queueTierBig: {
        fontSize: FontSize.base,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    queueRankNum: {
        fontSize: FontSize.base,
        fontWeight: '400',
        color: LoL.textSecondary,
        letterSpacing: 0.5,
    },
    queueLpText: {
        fontSize: FontSize.xs,
        fontWeight: '600',
        color: LoL.textMuted,
        letterSpacing: 0.3,
    },
    queueEmblem: {
        width: 48,
        height: 48,
    },
    wlBarTrack: {
        flexDirection: 'row',
        height: 6,
        borderRadius: Radius.full,
        overflow: 'hidden',
        gap: 2,
    },
    wlBarSegment: {
        borderRadius: Radius.full,
    },
    queueBottom: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    queueBottomStat: {
        gap: 2,
    },
    queueBottomCenter: {
        alignItems: 'center',
        gap: 2,
    },
    queueStatBig: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
    },
    queueStatSmall: {
        fontSize: FontSize.xs,
        color: LoL.textSecondary,
        letterSpacing: 0.3,
    },
    queueWinRateBig: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
    },

    // Stat blocks
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    statBlock: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { fontSize: FontSize.xl, fontWeight: '800', color: LoL.goldLight },
    statLabel: { fontSize: FontSize.xs, color: LoL.textSecondary, textAlign: 'center' },
    divider: { width: 1, height: 40, backgroundColor: LoL.goldDark },

    // Champion rows
    champRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
    champRank: { width: 20, fontSize: FontSize.xs, fontWeight: '700', color: LoL.textMuted, textAlign: 'center' },
    champIcon: { width: 44, height: 44, borderRadius: Radius.sm, borderWidth: 1, borderColor: LoL.goldDark },
    champMid: { flex: 1, gap: 3 },
    champName: { fontSize: FontSize.md, fontWeight: '700', color: LoL.textPrimary },
    champSub: { fontSize: FontSize.xs, color: LoL.textSecondary },
    champRight: { alignItems: 'flex-end', gap: 3 },
    champPts: { fontSize: FontSize.lg, fontWeight: '800', color: LoL.gold },
    champGames: { fontSize: FontSize.xs, color: LoL.textSecondary },
    rowDivider: { height: 1, backgroundColor: LoL.goldDeep, marginVertical: 2 },

    // Performance
    perfGrid: { flexDirection: 'row', alignItems: 'center' },
    perfBlock: { flex: 1, alignItems: 'center', gap: 4 },
    perfLabel: {
        fontSize: FontSize.xs,
        fontWeight: '700',
        color: LoL.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    perfValue: { fontSize: FontSize.base, fontWeight: '800', color: LoL.goldLight },
    perfSub: { fontSize: FontSize.xs, color: LoL.textMuted },
})
