import { Game, League, MINNESOTA_TEAMS } from '../types/sports';

/**
 * Sports API Client using ESPN's public API
 * ESPN provides free access to sports scores and schedules
 */
export class SportsApiClient {
  private readonly ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

  /**
   * Get the ESPN API endpoint for a specific league
   */
  private getLeagueEndpoint(league: League): string {
    const endpoints: Record<League, string> = {
      NFL: `${this.ESPN_BASE_URL}/football/nfl/scoreboard`,
      MLB: `${this.ESPN_BASE_URL}/baseball/mlb/scoreboard`,
      NBA: `${this.ESPN_BASE_URL}/basketball/nba/scoreboard`,
      NHL: `${this.ESPN_BASE_URL}/hockey/nhl/scoreboard`,
      WNBA: `${this.ESPN_BASE_URL}/basketball/wnba/scoreboard`,
      MLS: `${this.ESPN_BASE_URL}/soccer/usa.1/scoreboard`,
      NCAAF: `${this.ESPN_BASE_URL}/football/college-football/scoreboard`,
      NCAAB: `${this.ESPN_BASE_URL}/basketball/mens-college-basketball/scoreboard`,
    };
    return endpoints[league];
  }

  /**
   * Fetch scores for a specific date
   * @param date - Date in YYYYMMDD format
   * @param league - League to fetch scores for
   */
  async fetchScoresForLeague(date: string, league: League): Promise<Game[]> {
    const endpoint = `${this.getLeagueEndpoint(league)}?dates=${date}`;

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        console.error(`Failed to fetch ${league} scores: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      return this.parseEspnResponse(data, league);
    } catch (error) {
      console.error(`Error fetching ${league} scores:`, error);
      return [];
    }
  }

  /**
   * Parse ESPN API response into our Game format
   */
  private parseEspnResponse(data: any, league: League): Game[] {
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
        },
        awayTeam: {
          name: awayTeam?.team?.displayName || 'Unknown',
          abbreviation: awayTeam?.team?.abbreviation,
          score: parseInt(awayTeam?.score) || undefined,
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

  /**
   * Fetch all Minnesota team games for a specific date
   * @param date - Date in YYYYMMDD format
   */
  async fetchMinnesotaGames(date: string): Promise<Game[]> {
    // Get unique leagues from Minnesota teams
    const leagues = [...new Set(MINNESOTA_TEAMS.map(t => t.league))];

    // Fetch scores for all leagues in parallel
    const allGamesPromises = leagues.map(league =>
      this.fetchScoresForLeague(date, league)
    );

    const allGamesResults = await Promise.all(allGamesPromises);
    const allGames = allGamesResults.flat();

    // Filter for Minnesota teams only
    return allGames.filter(game => this.isMinnesotaGame(game));
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
   * Fetch upcoming games (today and tomorrow)
   */
  async fetchUpcomingGames(): Promise<Game[]> {
    const today = this.getTodayDate();
    const tomorrow = this.getTomorrowDate();

    const [todayGames, tomorrowGames] = await Promise.all([
      this.fetchMinnesotaGames(today),
      this.fetchMinnesotaGames(tomorrow),
    ]);

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
