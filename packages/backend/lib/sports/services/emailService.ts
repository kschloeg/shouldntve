import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Game } from '../types/sports';

export class EmailService {
  private sesClient: SESClient;
  private fromAddress: string;

  constructor(fromAddress: string, region: string = 'us-east-1') {
    this.sesClient = new SESClient({ region });
    this.fromAddress = fromAddress;
  }

  /**
   * Generate HTML email content for game results and upcoming games
   */
  private generateEmailHtml(games: Game[], upcomingGames: Game[], date: string): string {
    const gamesHtml = games.length > 0
      ? games.map(game => this.generateGameHtml(game, false)).join('')
      : '<div class="content"><p>No Minnesota teams played yesterday.</p></div>';

    const upcomingHtml = upcomingGames.length > 0
      ? `
        <div class="section-header">
          <h2>📅 Upcoming Games (Next 24 Hours)</h2>
        </div>
        ${upcomingGames.map(game => this.generateGameHtml(game, true)).join('')}
      `
      : '';

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #862334; color: white; padding: 20px; text-align: center; }
            .section-header { background-color: #f0f0f0; padding: 15px; margin: 20px 0 10px 0; border-radius: 8px; text-align: center; }
            .section-header h2 { margin: 0; color: #862334; font-size: 20px; }
            .game { background-color: white; margin: 15px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .league-badge { background-color: #003f87; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
            .teams { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; }
            .team { flex: 1; text-align: center; }
            .team-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .score { font-size: 32px; font-weight: bold; color: #862334; }
            .vs { color: #666; font-size: 18px; margin: 0 10px; }
            .status { color: #666; font-size: 14px; margin-top: 10px; }
            .game-time { color: #003f87; font-weight: bold; font-size: 14px; margin-top: 5px; }
            .winner { color: #00a651; }
            .loser { color: #c41e3a; }
            .content { padding: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏆 Minnesota Sports</h1>
              <p>${this.formatDate(date)}</p>
            </div>
            ${gamesHtml}
            ${upcomingHtml}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Format team record for display
   */
  private formatRecord(record?: { wins: number; losses: number; ties?: number }): string {
    if (!record) return '';

    const tiesStr = record.ties !== undefined ? `-${record.ties}` : '';
    return ` (${record.wins}-${record.losses}${tiesStr})`;
  }

  /**
   * Generate HTML for a single game
   */
  private generateGameHtml(game: Game, isUpcoming: boolean): string {
    const isMinnesotaHome = this.isMinnesotaTeam(game.homeTeam.name);
    const homeWon = (game.homeTeam.score ?? 0) > (game.awayTeam.score ?? 0);
    const awayWon = (game.awayTeam.score ?? 0) > (game.homeTeam.score ?? 0);

    const homeClass = game.status === 'final' && homeWon ? 'winner' : (game.status === 'final' && awayWon ? 'loser' : '');
    const awayClass = game.status === 'final' && awayWon ? 'winner' : (game.status === 'final' && homeWon ? 'loser' : '');

    const awayRecord = this.formatRecord(game.awayTeam.record);
    const homeRecord = this.formatRecord(game.homeTeam.record);

    const gameTimeHtml = isUpcoming
      ? `<div class="game-time">${this.formatGameTime(game.date)}</div>`
      : '';

    return `
      <div class="game">
        <span class="league-badge">${game.league}</span>
        <div class="teams">
          <div class="team">
            <div class="team-name ${awayClass}">${game.awayTeam.name}${awayRecord}</div>
            <div class="score">${game.awayTeam.score ?? '-'}</div>
          </div>
          <div class="vs">@</div>
          <div class="team">
            <div class="team-name ${homeClass}">${game.homeTeam.name}${homeRecord}</div>
            <div class="score">${game.homeTeam.score ?? '-'}</div>
          </div>
        </div>
        <div class="status">${this.getStatusText(game.status)}</div>
        ${gameTimeHtml}
      </div>
    `;
  }

  /**
   * Check if a team name is a Minnesota team
   */
  private isMinnesotaTeam(teamName: string): boolean {
    return teamName.toLowerCase().includes('minnesota') ||
           teamName.toLowerCase().includes('gopher');
  }

  /**
   * Get human-readable status text
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'final':
        return 'Final';
      case 'in_progress':
        return 'In Progress';
      case 'scheduled':
        return 'Scheduled';
      default:
        return status;
    }
  }

  /**
   * Format date string for display
   */
  private formatDate(dateStr: string): string {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(`${year}-${month}-${day}`);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format game time for display in Central Time
   */
  private formatGameTime(dateStr: string): string {
    const gameDate = new Date(dateStr);
    return gameDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
      timeZoneName: 'short'
    });
  }

  /**
   * Send email with game results and upcoming games
   */
  async sendScoresEmail(
    toAddress: string,
    games: Game[],
    upcomingGames: Game[],
    date: string
  ): Promise<void> {
    const parts = [];
    if (games.length > 0) {
      parts.push(`${games.length} Result${games.length !== 1 ? 's' : ''}`);
    }
    if (upcomingGames.length > 0) {
      parts.push(`${upcomingGames.length} Upcoming`);
    }

    const subject = parts.length > 0
      ? `Minnesota Sports - ${parts.join(', ')}`
      : 'Minnesota Sports - No Games';

    const htmlBody = this.generateEmailHtml(games, upcomingGames, date);

    const command = new SendEmailCommand({
      Source: this.fromAddress,
      Destination: {
        ToAddresses: [toAddress],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.sesClient.send(command);
      console.log(`Email sent successfully to ${toAddress}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}
