import { Game, MINNESOTA_TEAMS } from '../types/sports';

type EspnLeague = 'WNBA' | 'FIFA_WORLD_CUP';

/** League ID within its API-Sports host, and which host serves it. */
const API_SPORTS_LEAGUE: Record<'NFL' | 'NCAAF' | 'MLB' | 'NHL' | 'NBA' | 'NCAAB', { host: string; id: number }> = {
  NFL: { host: 'v1.american-football.api-sports.io', id: 1 },
  NCAAF: { host: 'v1.american-football.api-sports.io', id: 2 },
  MLB: { host: 'v1.baseball.api-sports.io', id: 1 },
  NHL: { host: 'v1.hockey.api-sports.io', id: 57 },
  NBA: { host: 'v1.basketball.api-sports.io', id: 12 },
  NCAAB: { host: 'v1.basketball.api-sports.io', id: 116 },
};
const API_SPORTS_SOCCER_HOST = 'v3.football.api-sports.io';

const FINISHED_STATUSES = new Set(['FT', 'AOT', 'AP', 'PEN']);
const SCHEDULED_STATUSES = new Set(['NS', 'TBD', 'POST', 'CANC', 'ABD']);

/**
 * Sports API Client.
 *
 * Most leagues are fetched from API-Sports (api-sports.io), which requires
 * API_SPORTS_KEY and is split across several per-sport hosts with slightly
 * different response shapes. WNBA has no API-Sports coverage at any tier, so
 * it still goes through ESPN's public (undocumented) API - which is known to
 * 403 requests from cloud/datacenter IPs like Lambda's, so WNBA scores may
 * come back empty; that's logged, not silently swallowed.
 */
export class SportsApiClient {
  private readonly ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

  // ---------------------------------------------------------------------
  // API-Sports (NFL, NCAAF, MLB, NHL, NBA, NCAAB, MLS)
  // ---------------------------------------------------------------------

  /**
   * GET an API-Sports endpoint and log the outcome. API-Sports returns
   * HTTP 200 even for plan/quota errors, embedding them in an `errors`
   * field instead - those are logged and treated as "no data" rather than
   * thrown, matching the graceful-degradation behavior of the rest of this
   * client (one league failing shouldn't break the others).
   */
  private async apiSportsGet(host: string, path: string, params: Record<string, string>): Promise<any[]> {
    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) {
      console.error('API_SPORTS_KEY is not set; skipping API-Sports request to', host + path);
      return [];
    }

    const query = new URLSearchParams(params).toString();
    const url = `https://${host}${path}?${query}`;

    try {
      const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
      const data: any = await response.json();

      if (!response.ok) {
        console.error(`API-Sports HTTP ${response.status} from ${url}:`, JSON.stringify(data));
        return [];
      }

      const errors = data?.errors;
      const hasErrors = errors && (Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0);
      if (hasErrors) {
        console.error(`API-Sports returned errors from ${url}:`, JSON.stringify(errors));
        return [];
      }

      console.log(`API-Sports ${url}: ${data.results ?? 0} results`);
      return Array.isArray(data.response) ? data.response : [];
    } catch (error) {
      console.error(`Error calling API-Sports (${url}):`, error);
      return [];
    }
  }

  private mapApiSportsStatus(short: string | undefined): 'scheduled' | 'in_progress' | 'final' {
    if (!short) return 'scheduled';
    if (FINISHED_STATUSES.has(short)) return 'final';
    if (SCHEDULED_STATUSES.has(short)) return 'scheduled';
    return 'in_progress';
  }

  private isMinnesotaName(name: string | undefined): boolean {
    const lower = name?.toLowerCase() ?? '';
    return lower.includes('minnesota') || lower.includes('gopher');
  }

  /** NFL and NCAAF share a host; `game.date` is a nested object, not a string. */
  private async fetchAmericanFootballGames(date: string, league: 'NFL' | 'NCAAF'): Promise<Game[]> {
    const { host, id } = API_SPORTS_LEAGUE[league];
    const games = await this.apiSportsGet(host, '/games', { date });

    return games
      .filter((g: any) => g.league?.id === id)
      .filter((g: any) => this.isMinnesotaName(g.teams?.home?.name) || this.isMinnesotaName(g.teams?.away?.name))
      .map((g: any) => ({
        id: String(g.game?.id),
        date: g.game?.date?.timestamp ? new Date(g.game.date.timestamp * 1000).toISOString() : new Date().toISOString(),
        homeTeam: { name: g.teams?.home?.name ?? 'Unknown', score: g.scores?.home?.total ?? undefined },
        awayTeam: { name: g.teams?.away?.name ?? 'Unknown', score: g.scores?.away?.total ?? undefined },
        status: this.mapApiSportsStatus(g.game?.status?.short),
        league,
        description: `${g.teams?.away?.name} @ ${g.teams?.home?.name}`,
      }));
  }

  /** MLB. `date` is an ISO string; scores are nested with a `.total`. */
  private async fetchBaseballGames(date: string): Promise<Game[]> {
    const { host, id } = API_SPORTS_LEAGUE.MLB;
    const games = await this.apiSportsGet(host, '/games', { date });

    return games
      .filter((g: any) => g.league?.id === id)
      .filter((g: any) => this.isMinnesotaName(g.teams?.home?.name) || this.isMinnesotaName(g.teams?.away?.name))
      .map((g: any) => ({
        id: String(g.id),
        date: g.date,
        homeTeam: { name: g.teams?.home?.name ?? 'Unknown', score: g.scores?.home?.total ?? undefined },
        awayTeam: { name: g.teams?.away?.name ?? 'Unknown', score: g.scores?.away?.total ?? undefined },
        status: this.mapApiSportsStatus(g.status?.short),
        league: 'MLB' as const,
        description: `${g.teams?.away?.name} @ ${g.teams?.home?.name}`,
      }));
  }

  /** NHL. `date` is an ISO string; scores are plain numbers (no `.total`). */
  private async fetchHockeyGames(date: string): Promise<Game[]> {
    const { host, id } = API_SPORTS_LEAGUE.NHL;
    const games = await this.apiSportsGet(host, '/games', { date });

    return games
      .filter((g: any) => g.league?.id === id)
      .filter((g: any) => this.isMinnesotaName(g.teams?.home?.name) || this.isMinnesotaName(g.teams?.away?.name))
      .map((g: any) => ({
        id: String(g.id),
        date: g.date,
        homeTeam: { name: g.teams?.home?.name ?? 'Unknown', score: g.scores?.home ?? undefined },
        awayTeam: { name: g.teams?.away?.name ?? 'Unknown', score: g.scores?.away ?? undefined },
        status: this.mapApiSportsStatus(g.status?.short),
        league: 'NHL' as const,
        description: `${g.teams?.away?.name} @ ${g.teams?.home?.name}`,
      }));
  }

  /** NBA and NCAAB share a host; same shape as baseball (ISO date, `.total` scores). */
  private async fetchBasketballGames(date: string, league: 'NBA' | 'NCAAB'): Promise<Game[]> {
    const { host, id } = API_SPORTS_LEAGUE[league];
    const games = await this.apiSportsGet(host, '/games', { date });

    return games
      .filter((g: any) => g.league?.id === id)
      .filter((g: any) => this.isMinnesotaName(g.teams?.home?.name) || this.isMinnesotaName(g.teams?.away?.name))
      .map((g: any) => ({
        id: String(g.id),
        date: g.date,
        homeTeam: { name: g.teams?.home?.name ?? 'Unknown', score: g.scores?.home?.total ?? undefined },
        awayTeam: { name: g.teams?.away?.name ?? 'Unknown', score: g.scores?.away?.total ?? undefined },
        status: this.mapApiSportsStatus(g.status?.short),
        league,
        description: `${g.teams?.away?.name} @ ${g.teams?.home?.name}`,
      }));
  }

  /**
   * MLS. Doesn't filter to a single league ID the way the other sports do:
   * Minnesota United's first team also plays cross-league tournaments (e.g.
   * the Leagues Cup) outside MLS's own league ID. It does need an allowlist
   * though - unrestricted, a plain "minnesota" name match also picks up
   * Minnesota United's reserve team in MLS Next Pro (a different league,
   * different roster), which is not what "Minnesota Sports" should mean.
   */
  private async fetchSoccerGames(date: string): Promise<Game[]> {
    const ALLOWED_LEAGUE_IDS = new Set([253 /* MLS */, 772 /* Leagues Cup */]);
    const fixtures = await this.apiSportsGet(API_SPORTS_SOCCER_HOST, '/fixtures', { date });

    return fixtures
      .filter((f: any) => ALLOWED_LEAGUE_IDS.has(f.league?.id))
      .filter((f: any) => this.isMinnesotaName(f.teams?.home?.name) || this.isMinnesotaName(f.teams?.away?.name))
      .map((f: any) => ({
        id: String(f.fixture?.id),
        date: f.fixture?.date,
        homeTeam: { name: f.teams?.home?.name ?? 'Unknown', score: f.goals?.home ?? undefined },
        awayTeam: { name: f.teams?.away?.name ?? 'Unknown', score: f.goals?.away ?? undefined },
        status: this.mapApiSportsStatus(f.fixture?.status?.short),
        league: 'MLS' as const,
        description: `${f.teams?.away?.name} @ ${f.teams?.home?.name}`,
      }));
  }

  // ---------------------------------------------------------------------
  // ESPN (WNBA only - see class doc comment; also still used for the
  // currently-disabled World Cup feature)
  // ---------------------------------------------------------------------

  private getEspnEndpoint(league: EspnLeague): string {
    const endpoints: Record<EspnLeague, string> = {
      WNBA: `${this.ESPN_BASE_URL}/basketball/wnba/scoreboard`,
      FIFA_WORLD_CUP: `${this.ESPN_BASE_URL}/soccer/fifa.world/scoreboard`,
    };
    return endpoints[league];
  }

  /**
   * Fetch scores for a specific date
   * @param date - Date in YYYYMMDD format
   * @param league - League to fetch scores for
   */
  async fetchScoresForLeague(date: string, league: EspnLeague): Promise<Game[]> {
    const endpoint = `${this.getEspnEndpoint(league)}?dates=${date}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          // ESPN's undocumented API 403s requests from server/cloud IPs that
          // don't look like a browser (e.g. Lambda's default fetch UA).
          // Known not to be sufficient on its own - ESPN appears to also
          // block by source IP/ASN, which this can't work around.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });
      const data: any = await response.json();

      if (!response.ok) {
        console.error(`ESPN HTTP ${response.status} for ${league} (${endpoint}):`, JSON.stringify(data));
        return [];
      }

      console.log(`ESPN ${league} (${endpoint}): ${Array.isArray(data.events) ? data.events.length : 0} events`);
      return this.parseEspnResponse(data, league);
    } catch (error) {
      console.error(`Error fetching ${league} scores from ESPN:`, error);
      return [];
    }
  }

  /**
   * Parse team record from ESPN data
   */
  private parseTeamRecord(competitor: any): { wins: number; losses: number; ties?: number } | undefined {
    try {
      const recordString = competitor?.records?.[0]?.summary;
      if (!recordString) return undefined;

      // Parse records like "10-5", "8-3-1", etc.
      const parts = recordString.split('-').map((n: string) => parseInt(n));
      if (parts.length < 2) return undefined;

      return {
        wins: parts[0] || 0,
        losses: parts[1] || 0,
        ties: parts[2] || undefined,
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Parse ESPN API response into our Game format
   */
  private parseEspnResponse(data: any, league: EspnLeague): Game[] {
    if (!data.events || !Array.isArray(data.events)) {
      return [];
    }

    return data.events.map((event: any) => {
      const competition = event.competitions?.[0];
      const homeTeam = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition?.competitors?.find((c: any) => c.homeAway === 'away');

      return {
        id: event.id,
        date: event.date,
        homeTeam: {
          name: homeTeam?.team?.displayName || 'Unknown',
          abbreviation: homeTeam?.team?.abbreviation,
          score: parseInt(homeTeam?.score) || undefined,
          record: this.parseTeamRecord(homeTeam),
        },
        awayTeam: {
          name: awayTeam?.team?.displayName || 'Unknown',
          abbreviation: awayTeam?.team?.abbreviation,
          score: parseInt(awayTeam?.score) || undefined,
          record: this.parseTeamRecord(awayTeam),
        },
        status: this.parseStatus(competition?.status?.type?.state),
        league,
        description: event.shortName || event.name,
      };
    });
  }

  /**
   * Parse ESPN status into our simplified status
   */
  private parseStatus(espnStatus: string): 'scheduled' | 'in_progress' | 'final' {
    if (!espnStatus) return 'scheduled';

    const status = espnStatus.toLowerCase();
    if (status.includes('final') || status.includes('post')) return 'final';
    if (status.includes('in') || status.includes('live')) return 'in_progress';
    return 'scheduled';
  }

  /**
   * Check if a game involves a Minnesota team
   */
  private isMinnesotaGame(game: Game): boolean {
    const mnTeam = MINNESOTA_TEAMS.find(t => t.league === game.league);
    if (!mnTeam) return false;

    const teamNames = [
      game.homeTeam.name,
      game.awayTeam.name,
      game.homeTeam.abbreviation,
      game.awayTeam.abbreviation,
    ];

    return teamNames.some(name =>
      name?.toLowerCase().includes('minnesota') ||
      name?.toLowerCase().includes('gopher') ||
      (mnTeam.abbreviation && name === mnTeam.abbreviation)
    );
  }

  // ---------------------------------------------------------------------
  // Public interface
  // ---------------------------------------------------------------------

  /** Convert our internal YYYYMMDD date format to API-Sports' YYYY-MM-DD. */
  private toApiSportsDate(yyyymmdd: string): string {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }

  /**
   * Fetch all Minnesota team games for a specific date
   * @param date - Date in YYYYMMDD format
   */
  async fetchMinnesotaGames(date: string): Promise<Game[]> {
    const apiSportsDate = this.toApiSportsDate(date);

    // ESPN is a separate service with its own (much looser) limits, so it
    // can run concurrently with the API-Sports chain below.
    const wnbaPromise = this.fetchScoresForLeague(date, 'WNBA');

    // The API-Sports calls are deliberately sequential, one request at a
    // time: its free tier enforces a per-minute rate limit, and firing
    // these seven concurrently reliably trips it, silently dropping
    // whichever leagues got rate-limited.
    const nfl = await this.fetchAmericanFootballGames(apiSportsDate, 'NFL');
    const ncaaf = await this.fetchAmericanFootballGames(apiSportsDate, 'NCAAF');
    const mlb = await this.fetchBaseballGames(apiSportsDate);
    const nhl = await this.fetchHockeyGames(apiSportsDate);
    const nba = await this.fetchBasketballGames(apiSportsDate, 'NBA');
    const ncaab = await this.fetchBasketballGames(apiSportsDate, 'NCAAB');
    const mls = await this.fetchSoccerGames(apiSportsDate);

    const wnbaGames = await wnbaPromise;
    const wnba = wnbaGames.filter(game => this.isMinnesotaGame(game));

    return [...nfl, ...ncaaf, ...mlb, ...nhl, ...nba, ...ncaab, ...mls, ...wnba];
  }

  /**
   * Get yesterday's date in YYYYMMDD format
   */
  getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  /**
   * Get today's date in YYYYMMDD format
   */
  getTodayDate(): string {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  /**
   * Get tomorrow's date in YYYYMMDD format
   */
  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  /**
   * Fetch all World Cup games for a specific date (no team filter)
   * @param date - Date in YYYYMMDD format
   */
  async fetchWorldCupGames(date: string): Promise<Game[]> {
    return this.fetchScoresForLeague(date, 'FIFA_WORLD_CUP');
  }

  /**
   * Fetch upcoming World Cup games (today and tomorrow, within next 24 hours)
   */
  async fetchUpcomingWorldCupGames(): Promise<Game[]> {
    const today = this.getTodayDate();
    const tomorrow = this.getTomorrowDate();

    const [todayGames, tomorrowGames] = await Promise.all([
      this.fetchWorldCupGames(today),
      this.fetchWorldCupGames(tomorrow),
    ]);

    const allGames = [...todayGames, ...tomorrowGames];

    return allGames.filter(game => {
      const gameTime = new Date(game.date);
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return gameTime >= now && gameTime <= next24Hours && game.status === 'scheduled';
    });
  }

  /**
   * Fetch upcoming games (today and tomorrow)
   */
  async fetchUpcomingGames(): Promise<Game[]> {
    const today = this.getTodayDate();
    const tomorrow = this.getTomorrowDate();

    // Sequential, not Promise.all: each date already fires ~8 concurrent
    // API-Sports requests (one per league), and stacking two of those at
    // once is enough to trip the free tier's per-minute rate limit.
    const todayGames = await this.fetchMinnesotaGames(today);
    const tomorrowGames = await this.fetchMinnesotaGames(tomorrow);

    const allGames = [...todayGames, ...tomorrowGames];

    // Filter for scheduled games only (not completed or in progress from today)
    return allGames.filter(game => {
      const gameTime = new Date(game.date);
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      return gameTime >= now && gameTime <= next24Hours && game.status === 'scheduled';
    });
  }
}
