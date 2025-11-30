import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

const client = new DynamoDBClient({});

export const handler = async (event?: {
  headers?: Record<string, string>;
}): Promise<{
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}> => {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error('Missing TABLE_NAME');
  }

  const origin = getRequestOrigin(event?.headers);

  const { Items } = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditions: {
        PK: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: 'USER' }],
        },
      },
    })
  );

  const results = (Items || []).map((item) => ({
    email: item.SK?.S ?? '',
    firstName: item.firstName?.S ?? '',
    lastName: item.lastName?.S ?? '',
    phone: item.phone?.S ?? '',
  }));

  return {
    statusCode: 200,
    body: JSON.stringify(results),
    headers: corsHeadersFromOrigin(origin, 'application/json'),
  };
};
