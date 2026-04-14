type ChampEntry = { key: string; id: string; name: string };

let cachedVersion: string | null = null;
let byNumericId: Record<number, ChampEntry> | null = null;

async function fetchVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const versions = await fetch(
    'https://ddragon.leagueoflegends.com/api/versions.json'
  ).then(r => r.json()) as string[];
  cachedVersion = versions[0];
  return cachedVersion;
}

async function loadChampions(): Promise<void> {
  if (byNumericId) return;
  const v = await fetchVersion();
  const { data } = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion.json`
  ).then(r => r.json()) as { data: Record<string, ChampEntry> };

  byNumericId = {};
  for (const champ of Object.values(data)) {
    byNumericId[Number(champ.key)] = champ;
  }
}

export async function championById(id: number): Promise<ChampEntry | null> {
  await loadChampions();
  return byNumericId?.[id] ?? null;
}

export const getLatestVersion = fetchVersion;

// URL helpers
export const DDragon = {
  splash: (key: string) =>
    `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`,
  tile: (key: string) =>
    `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${key}_0.jpg`,
  rankEmblem: (tier: string) =>
    `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`,
  item: (version: string, itemId: number) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`,
};

// Format mastery points: 1 234 567 → "1.2M", 234 567 → "234K"
export function formatMastery(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000)     return `${Math.round(pts / 1_000)}K`;
  return String(pts);
}
