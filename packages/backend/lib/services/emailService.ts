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
   * Generate HTML email content for game results
   */
  private generateEmailHtml(games: Game[], date: string): string {
    if (games.length === 0) {
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #862334; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏆 Minnesota Sports Scores</h1>
              </div>
              <div class="content">
                <p>No Minnesota teams played on ${this.formatDate(date)}.</p>
                <p>Check back tomorrow for the latest scores!</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    const gamesHtml = games
      .map(game => this.generateGameHtml(game))
      .join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #862334; color: white; padding: 20px; text-align: center; }
            .game { background-color: white; margin: 15px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .league-badge { background-color: #003f87; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
            .teams { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; }
            .team { flex: 1; text-align: center; }
            .team-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
            .score { font-size: 32px; font-weight: bold; color: #862334; }
            .vs { color: #666; font-size: 18px; margin: 0 10px; }
            .status { color: #666; font-size: 14px; margin-top: 10px; }
            .winner { color: #00a651; }
            .loser { color: #c41e3a; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏆 Minnesota Sports Scores</h1>
              <p>${this.formatDate(date)}</p>
            </div>
            ${gamesHtml}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for a single game
   */
  private generateGameHtml(game: Game): string {
    const isMinnesotaHome = this.isMinnesotaTeam(game.homeTeam.name);
    const homeWon = (game.homeTeam.score ?? 0) > (game.awayTeam.score ?? 0);
    const awayWon = (game.awayTeam.score ?? 0) > (game.homeTeam.score ?? 0);

    const homeClass = game.status === 'final' && homeWon ? 'winner' : (game.status === 'final' && awayWon ? 'loser' : '');
    const awayClass = game.status === 'final' && awayWon ? 'winner' : (game.status === 'final' && homeWon ? 'loser' : '');

    return `
      <div class="game">
        <span class="league-badge">${game.league}</span>
        <div class="teams">
          <div class="team">
            <div class="team-name ${awayClass}">${game.awayTeam.name}</div>
            <div class="score">${game.awayTeam.score ?? '-'}</div>
          </div>
          <div class="vs">@</div>
          <div class="team">
            <div class="team-name ${homeClass}">${game.homeTeam.name}</div>
            <div class="score">${game.homeTeam.score ?? '-'}</div>
          </div>
        </div>
        <div class="status">${this.getStatusText(game.status)}</div>
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
   * Send email with game results
   */
  async sendScoresEmail(
    toAddress: string,
    games: Game[],
    date: string
  ): Promise<void> {
    const subject = games.length > 0
      ? `Minnesota Sports Scores - ${games.length} Game${games.length !== 1 ? 's' : ''}`
      : 'Minnesota Sports Scores - No Games Today';

    const htmlBody = this.generateEmailHtml(games, date);

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
