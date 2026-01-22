import { EventBridgeEvent } from 'aws-lambda';
import { SportsApiClient } from '../services/sportsApiClient';
import { EmailService } from '../services/emailService';

/**
 * Lambda handler that runs daily at 4am to fetch and email Minnesota sports scores
 */
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

    // Fetch all Minnesota games from yesterday and upcoming games
    const [yesterdayGames, upcomingGames] = await Promise.all([
      sportsClient.fetchMinnesotaGames(yesterdayDate),
      sportsClient.fetchUpcomingGames(),
    ]);

    console.log(`Found ${yesterdayGames.length} Minnesota games from yesterday`);
    console.log(`Found ${upcomingGames.length} upcoming games in next 24 hours`);

    // Filter for completed games only
    const completedGames = yesterdayGames.filter(game => game.status === 'final');
    console.log(`${completedGames.length} games were completed`);

    // Send email with results and upcoming games
    await emailService.sendScoresEmail(recipientEmail, completedGames, upcomingGames, yesterdayDate);
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

  } catch (error) {
    console.error('Error in daily sports scores handler:', error);
    throw error;
  }
};
