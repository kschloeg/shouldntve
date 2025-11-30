import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getRequestOrigin, corsHeadersFromOrigin } from '../utils/cors';

const client = new DynamoDBClient({});

export interface User {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export const handler = async (event: {
  body: string;
}): Promise<{
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}> => {
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error('Missing TABLE_NAME');
  }

  let user: User = {
    email: '',
    firstName: '',
    lastName: '',
  };

  try {
    const { email, firstName, lastName } = JSON.parse(event.body) as User;
    user.email = email.trim().toLowerCase();
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
  } catch (error) {
    console.error(error);
    return {
      statusCode: 400,
      body: 'Invalid JSON',
    };
  }

  if (!user.email || !user.firstName || !user.lastName) {
    return {
      statusCode: 400,
      body: 'Missing parameters',
    };
  }

  try {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          PK: { S: 'USER' },
          SK: { S: user.email },
          firstName: { S: user.firstName },
          lastName: { S: user.lastName },
          phone: { S: user.phone || 'unknown' },
        },
      })
    );

    const origin = getRequestOrigin((event as any).headers);
    return {
      statusCode: 200,
      body: 'User created',
      headers: corsHeadersFromOrigin(origin, 'application/json'),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: `Internal server error: ${error}`,
    };
  }
};
