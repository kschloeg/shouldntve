# Daily Minnesota Sports Scores

This feature automatically checks for Minnesota sports team scores each morning and emails the results.

## Teams Tracked

- **NFL**: Minnesota Vikings
- **MLB**: Minnesota Twins
- **NBA**: Minnesota Timberwolves
- **NHL**: Minnesota Wild
- **WNBA**: Minnesota Lynx
- **MLS**: Minnesota United FC
- **NCAA Football**: Minnesota Golden Gophers
- **NCAA Basketball**: Minnesota Golden Gophers

## How It Works

1. **Scheduled Trigger**: An EventBridge rule triggers the Lambda function daily at 4:00 AM CST (10:00 AM UTC)
2. **Score Fetching**: The function queries ESPN's public API for scores from the previous day
3. **Filtering**: Only games involving Minnesota teams are included
4. **Email Notification**: Results are sent via AWS SES to the configured email address

## Architecture

```
EventBridge (Cron) → Lambda Function → ESPN API
                            ↓
                      AWS SES (Email)
```

### Components

- **Lambda Function**: `lib/functions/dailySportsScores.ts`
- **Sports API Client**: `lib/services/sportsApiClient.ts`
- **Email Service**: `lib/services/emailService.ts`
- **Type Definitions**: `lib/types/sports.ts`

## Configuration

### Environment Variables

Edit `packages/backend/.env`:

```bash
# Email address to receive daily sports scores
SPORTS_RECIPIENT_EMAIL=kschloeg@gmail.com

# SES verified sender email (already configured)
SES_FROM_ADDRESS=kschloeg@gmail.com
```

### Adding More Teams

To add additional teams to track, edit `lib/types/sports.ts`:

```typescript
export const MINNESOTA_TEAMS: Team[] = [
  // ... existing teams
  { name: 'New Team', displayName: 'Full Team Name', abbreviation: 'ABR', league: 'NFL' },
];
```

Supported leagues: `'NFL' | 'MLB' | 'NBA' | 'NHL' | 'WNBA' | 'MLS' | 'NCAAF' | 'NCAAB'`

## Deployment

### Initial Deployment

```bash
cd packages/backend
npm run build
npm run cdk deploy
```

### SES Setup

Before the emails will work, you need to verify the sender email in AWS SES:

1. Go to AWS SES Console → Email Addresses
2. Click "Verify a New Email Address"
3. Enter `kschloeg@gmail.com`
4. Check your email and click the verification link

> **Note**: If your AWS account is in SES Sandbox mode, you'll also need to verify the recipient email address.

### Testing the Function

You can manually invoke the Lambda function to test it:

```bash
aws lambda invoke \
  --function-name BackendStack-DailySportsScores \
  --region us-east-1 \
  output.json
```

Or trigger it via the AWS Console:
1. Go to Lambda → Functions → BackendStack-DailySportsScores
2. Click "Test"
3. Use any test event (the function ignores the event payload)

## Schedule Modification

To change the schedule time, edit `lib/backend-stack.ts`:

```typescript
const dailySportsRule = new cdk.aws_events.Rule(this, 'DailySportsScoresRule', {
  schedule: cdk.aws_events.Schedule.cron({
    minute: '0',
    hour: '10', // 4am CST = 10am UTC (adjust as needed)
    day: '*',
    month: '*',
    year: '*',
  }),
});
```

> **Important**: EventBridge uses UTC time. CST is UTC-6, CDT is UTC-5.

## Monitoring

### CloudWatch Logs

View logs for the Lambda function:

```bash
aws logs tail /aws/lambda/BackendStack-DailySportsScores --follow
```

Or in AWS Console:
1. Go to CloudWatch → Log Groups
2. Find `/aws/lambda/BackendStack-DailySportsScores`

### Troubleshooting

**No email received?**
- Check SES email verification status
- Check Lambda CloudWatch logs for errors
- Verify the EventBridge rule is enabled
- Check spam/junk folder

**Missing games?**
- The API only returns games that have finished (status = 'final')
- Games still in progress won't be included
- Check CloudWatch logs to see what was fetched

**API Rate Limits?**
- ESPN's API is generally permissive for reasonable use
- The function fetches data for 8 leagues sequentially
- Current timeout is 60 seconds which should be sufficient

## Email Format

The email includes:
- **Header**: Date and number of games
- **Game Cards**: Each game shows:
  - League badge (NFL, NBA, etc.)
  - Away team @ Home team
  - Final scores
  - Color coding: Winners in green, losers in red
- **Empty State**: If no games were played, you'll get a brief notification

## Cost Considerations

- **Lambda**: ~1 second execution time, 512MB memory → ~$0.000001 per run
- **SES**: First 1,000 emails/month are free, then $0.10 per 1,000
- **EventBridge**: First 1M events free per month
- **Total**: Essentially free for personal use (~$0.03/year)

## Data Source

This feature uses ESPN's public API endpoints:
- No API key required
- No rate limit for reasonable use
- Data updated in near real-time during games
- Historical scores available

## Future Enhancements

Potential improvements:
- Add support for more teams/leagues
- Include game highlights or stats
- Add push notifications
- Create a web dashboard
- Add playoff/bracket tracking
- Include betting lines or predictions
