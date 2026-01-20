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

    // Fetch all Minnesota games from yesterday
    const games = await sportsClient.fetchMinnesotaGames(yesterdayDate);
    console.log(`Found ${games.length} Minnesota games`);

    // Filter for completed games only
    const completedGames = games.filter(game => game.status === 'final');
    console.log(`${completedGames.length} games were completed`);

    // Send email with results
    await emailService.sendScoresEmail(recipientEmail, completedGames, yesterdayDate);
    console.log('Successfully sent scores email');

    // Log results for CloudWatch
    completedGames.forEach(game => {
      console.log(
        `${game.league}: ${game.awayTeam.name} ${game.awayTeam.score} @ ${game.homeTeam.name} ${game.homeTeam.score}`
      );
    });

  } catch (error) {
    console.error('Error in daily sports scores handler:', error);
    throw error;
  }
};
