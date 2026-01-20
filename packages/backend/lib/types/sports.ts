export interface Team {
  name: string;
  displayName: string;
  abbreviation?: string;
  league: League;
}

export type League = 'NFL' | 'MLB' | 'NBA' | 'NHL' | 'WNBA' | 'MLS' | 'NCAAF' | 'NCAAB';

export interface Game {
  id: string;
  date: string;
  homeTeam: {
    name: string;
    score?: number;
    abbreviation?: string;
  };
  awayTeam: {
    name: string;
    score?: number;
    abbreviation?: string;
  };
  status: 'scheduled' | 'in_progress' | 'final';
  league: League;
  description?: string;
}

export interface DailyScoresResult {
  date: string;
  games: Game[];
  teamsTracked: Team[];
}

export const MINNESOTA_TEAMS: Team[] = [
  { name: 'Vikings', displayName: 'Minnesota Vikings', abbreviation: 'MIN', league: 'NFL' },
  { name: 'Twins', displayName: 'Minnesota Twins', abbreviation: 'MIN', league: 'MLB' },
  { name: 'Timberwolves', displayName: 'Minnesota Timberwolves', abbreviation: 'MIN', league: 'NBA' },
  { name: 'Wild', displayName: 'Minnesota Wild', abbreviation: 'MIN', league: 'NHL' },
  { name: 'Lynx', displayName: 'Minnesota Lynx', abbreviation: 'MIN', league: 'WNBA' },
  { name: 'United', displayName: 'Minnesota United FC', abbreviation: 'MIN', league: 'MLS' },
  { name: 'Gophers Football', displayName: 'Minnesota Golden Gophers', abbreviation: 'MINN', league: 'NCAAF' },
  { name: 'Gophers Basketball', displayName: 'Minnesota Golden Gophers', abbreviation: 'MINN', league: 'NCAAB' },
];
