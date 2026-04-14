import i18n from '@/i18n'

const API_KEY = process.env.EXPO_PUBLIC_RIOT_API_KEY ?? ''

// Maps platform (server) → cluster (regional routing)
const CLUSTER: Record<string, string> = {
    na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
    euw1: 'europe', eun1: 'europe', ru: 'europe', tr1: 'europe',
    kr: 'asia', jp1: 'asia',
    oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea',
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Dev key limits: 20 req/s · 100 req/2min — we stay at 18/s and 90/2min for safety

class RateLimiter {
    private readonly limitPerSecond = 18
    private readonly limitPer2Min = 90

    private tsSecond: number[] = []
    private ts2Min: number[] = []

    private queue: Array<() => void> = []
    private running = false

    throttle(): Promise<void> {
        return new Promise(resolve => {
            this.queue.push(resolve)
            this.drain()
        })
    }

    private async drain() {
        if (this.running) return
        this.running = true

        while (this.queue.length > 0) {
            const now = Date.now()
            this.tsSecond = this.tsSecond.filter(t => now - t < 1_000)
            this.ts2Min = this.ts2Min.filter(t => now - t < 120_000)

            if (this.tsSecond.length >= this.limitPerSecond) {
                await sleep(1_000 - (now - this.tsSecond[0]) + 20)
                continue
            }
            if (this.ts2Min.length >= this.limitPer2Min) {
                await sleep(120_000 - (now - this.ts2Min[0]) + 20)
                continue
            }

            const ts = Date.now()
            this.tsSecond.push(ts)
            this.ts2Min.push(ts)
            this.queue.shift()!()
        }

        this.running = false
    }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const limiter = new RateLimiter()

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function riotGet<T>(url: string): Promise<T> {
    await limiter.throttle()
    const res = await fetch(url, { headers: { 'X-Riot-Token': API_KEY } })
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { status?: { message?: string } }
        const msg = body?.status?.message
        if (res.status === 403) {
            const mess = `403 sur : ${url}\nMessage : ${msg ?? 'Forbidden'}`
            console.log(mess)
            throw new Error(mess)
        }
        if (res.status === 404) throw new Error(i18n.t('api.summonerNotFound'))
        if (res.status === 429) {
            const retryAfter = Number(res.headers.get('Retry-After') ?? 1) * 1_000 + 200
            await sleep(retryAfter)
            return riotGet<T>(url)
        }
        throw new Error(msg ?? i18n.t('api.error', { status: res.status }))
    }
    return res.json() as Promise<T>
}

// ── Platform list (for region picker in settings) ────────────────────────────

export const PLATFORMS = [
    { label: 'EUW', value: 'euw1' },
    { label: 'EUNE', value: 'eun1' },
    { label: 'NA', value: 'na1' },
    { label: 'KR', value: 'kr' },
    { label: 'BR', value: 'br1' },
    { label: 'TR', value: 'tr1' },
    { label: 'RU', value: 'ru' },
    { label: 'JP', value: 'jp1' },
    { label: 'OCE', value: 'oc1' },
]

// ── DTO types ────────────────────────────────────────────────────────────────

export type AccountDto = {
    puuid: string;
    gameName: string;
    tagLine: string;
};

export type SummonerDto = {
    puuid: string;
    profileIconId: number;
    summonerLevel: number;
};

export type LeagueEntryDto = {
    queueType: string;
    tier: string;
    rank: string;
    leaguePoints: number;
    wins: number;
    losses: number;
};

export type MasteryDto = {
    championId: number;
    championLevel: number;
    championPoints: number;
};

export type ParticipantDto = {
    puuid: string;
    championName: string;
    kills: number;
    deaths: number;
    assists: number;
    win: boolean;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    visionScore: number;
    item0: number;
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number;
    doubleKills: number;
    tripleKills: number;
    quadraKills: number;
    pentaKills: number;
    totalDamageDealtToChampions: number;
    goldEarned: number;
    teamPosition: string;
    teamId: number;
    riotIdGameName: string;
};

export type MatchDto = {
    metadata: { matchId: string };
    info: {
        gameDuration: number;
        gameEndTimestamp: number;
        queueId: number;
        participants: ParticipantDto[];
    };
};

// ── API calls ────────────────────────────────────────────────────────────────

export const getAccount = (gameName: string, tagLine: string, platform: string) =>
    riotGet<AccountDto>(
        `https://${CLUSTER[platform] ?? 'europe'}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    )

export const getSummoner = (puuid: string, platform: string) =>
    riotGet<SummonerDto>(
        `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    )

export const getRankedEntries = (puuid: string, platform: string) =>
    riotGet<LeagueEntryDto[]>(
        `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
    )

export const getTopMasteries = (puuid: string, platform: string, count = 3) =>
    riotGet<MasteryDto[]>(
        `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
    )

export const getRecentMatchIds = (puuid: string, platform: string, count = 7) =>
    riotGet<string[]>(
        `https://${CLUSTER[platform] ?? 'europe'}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&queue=420`,
    )

export const getMatchHistory = (puuid: string, platform: string, count = 20, queue?: number) =>
    riotGet<string[]>(
        `https://${CLUSTER[platform] ?? 'europe'}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}${queue != null ? `&queue=${queue}` : ''}`,
    )

export const getTopMasteriesAll = (puuid: string, platform: string, count = 50) =>
    riotGet<MasteryDto[]>(
        `https://${platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
    )

export const getMatch = (matchId: string, platform: string) =>
    riotGet<MatchDto>(
        `https://${CLUSTER[platform] ?? 'europe'}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
    )
