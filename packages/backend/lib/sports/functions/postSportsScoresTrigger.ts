import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { corsHeadersFromOrigin } from '../../utils/cors';
import { getSubjectFromHeaders } from '../../utils/authHelpers';

/**
 * API endpoint to manually trigger the daily sports scores Lambda
 * Requires authentication
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const origin = process.env.FRONTEND_ORIGIN || '*';
  const corsHeaders = corsHeadersFromOrigin(origin, 'application/json');

  try {
    // Verify authentication
    const subject = await getSubjectFromHeaders(event.headers as Record<string, string>);
    if (!subject) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Trigger the sports scores Lambda
    const lambdaArn = process.env.SPORTS_LAMBDA_ARN;
    if (!lambdaArn) {
      throw new Error('SPORTS_LAMBDA_ARN not configured');
    }

    const lambdaClient = new LambdaClient({});
    const command = new InvokeCommand({
      FunctionName: lambdaArn,
      InvocationType: 'Event', // Async invocation
    });

    await lambdaClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Sports scores check triggered successfully',
      }),
    };
  } catch (error) {
    console.error('Error triggering sports scores:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to trigger sports scores check',
      }),
    };
  }
};
