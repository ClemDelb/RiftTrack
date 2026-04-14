import { MatchDto } from './riot-api';

let _match: MatchDto | null = null;
let _puuid: string = '';

export function setCurrentMatch(match: MatchDto, puuid: string): void {
  _match = match;
  _puuid = puuid;
}

export function getCurrentMatch(): { match: MatchDto | null; puuid: string } {
  return { match: _match, puuid: _puuid };
}
