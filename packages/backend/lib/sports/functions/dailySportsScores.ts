import { EventBridgeEvent } from 'aws-lambda';
import { SportsApiClient } from '../services/sportsApiClient';
import { EmailService } from '../services/emailService';

/**
 * Lambda handler that runs daily at 4am to fetch and email Minnesota sports scores
 */
// World Cup coverage is off between tournaments. Flip back to true when the
// 2027 Women's World Cup begins.
const WORLD_CUP_ENABLED = false;

export const handler = async (
  event: EventBridgeEvent<'Scheduled Event', any>
): Promise<void> => {
  console.log('Starting daily sports scores check...');

  const recipientEmail = process.env.RECIPIENT_EMAIL;
  const senderEmail = process.env.SES_FROM_ADDRESS;

  if (!recipientEmail || !senderEmail) {
    throw new Error('Missing required environment variables: RECIPIENT_EMAIL or SES_FROM_ADDRESS');
  }

  try {
    // Initialize services
    const sportsClient = new SportsApiClient();
    const emailService = new EmailService(senderEmail);

    // Get yesterday's date
    const yesterdayDate = sportsClient.getYesterdayDate();
    console.log(`Fetching scores for date: ${yesterdayDate}`);

    // Fetch sequentially, not in parallel: each of these fires several
    // concurrent API-Sports requests internally (one per league), and
    // stacking them all at once is enough to trip the free tier's
    // per-minute rate limit.
    const yesterdayGames = await sportsClient.fetchMinnesotaGames(yesterdayDate);
    const upcomingGames = await sportsClient.fetchUpcomingGames();
    const yesterdayWCGames = WORLD_CUP_ENABLED ? await sportsClient.fetchWorldCupGames(yesterdayDate) : [];
    const upcomingWCGames = WORLD_CUP_ENABLED ? await sportsClient.fetchUpcomingWorldCupGames() : [];

    console.log(`Found ${yesterdayGames.length} Minnesota games from yesterday`);
    console.log(`Found ${upcomingGames.length} upcoming MN games in next 24 hours`);
    console.log(`Found ${yesterdayWCGames.length} World Cup games from yesterday`);
    console.log(`Found ${upcomingWCGames.length} upcoming World Cup matches in next 24 hours`);

    // Filter for completed games only
    const completedGames = yesterdayGames.filter(game => game.status === 'final');
    const completedWCGames = yesterdayWCGames.filter(game => game.status === 'final');
    console.log(`${completedGames.length} MN games were completed`);
    console.log(`${completedWCGames.length} World Cup matches were completed`);

    // Send email with results and upcoming games
    await emailService.sendScoresEmail(recipientEmail, completedGames, upcomingGames, yesterdayDate, completedWCGames, upcomingWCGames);
    console.log('Successfully sent scores email');

    // Log results for CloudWatch
    completedGames.forEach(game => {
      console.log(
        `COMPLETED - ${game.league}: ${game.awayTeam.name} ${game.awayTeam.score} @ ${game.homeTeam.name} ${game.homeTeam.score}`
      );
    });

    upcomingGames.forEach(game => {
      console.log(
        `UPCOMING - ${game.league}: ${game.awayTeam.name} @ ${game.homeTeam.name} at ${game.date}`
      );
    });

    completedWCGames.forEach(game => {
      console.log(
        `WC COMPLETED: ${game.awayTeam.name} ${game.awayTeam.score} @ ${game.homeTeam.name} ${game.homeTeam.score}`
      );
    });

    upcomingWCGames.forEach(game => {
      console.log(
        `WC UPCOMING: ${game.awayTeam.name} @ ${game.homeTeam.name} at ${game.date}`
      );
    });

  } catch (error) {
    console.error('Error in daily sports scores handler:', error);
    throw error;
  }
};
