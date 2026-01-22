import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { join } from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    dotenv.config({ path: `${__dirname}/../.env` });

    const queue = new sqs.Queue(this, 'MyQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
    });

    const api = new cdk.aws_apigateway.RestApi(this, 'RestApi', {});

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN || 'https://shouldntve.com';

    //   POST /auth/request-otp -> functions/postAuthRequestOtp.ts
    //   POST /auth/verify-otp  -> functions/postAuthVerifyOtp.ts
    //   POST /auth/logout      -> functions/postAuthLogout.ts
    //   GET  /protected     -> functions/getProtected.ts
    //   GET  /users         -> functions/getUsers.ts
    //   POST /users         -> functions/postUsers.ts
    //   PUT  /users         -> functions/putUsers.ts

    const users = api.root.addResource('users');
    // Use configured frontend origin instead of wildcard so preflight returns a specific origin
    users.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });

    const table = new cdk.aws_dynamodb.Table(this, 'UsersTable', {
      partitionKey: {
        name: 'PK',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: cdk.aws_dynamodb.AttributeType.STRING,
      },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const otpTable = new cdk.aws_dynamodb.Table(this, 'AuthOtpsTable', {
      partitionKey: { name: 'PK', type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
    });

    const otpSecret = new cdk.aws_secretsmanager.Secret(this, 'OtpSecret', {
      description: 'OTP secret for HMAC hashing of one-time codes',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'otp',
        passwordLength: 40,
      },
    });

    const jwtSecret = new cdk.aws_secretsmanager.Secret(this, 'JwtSecret', {
      description: 'JWT signing secret for auth tokens',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'jwt',
        passwordLength: 64,
      },
    });

    const getUsers = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'ListUsers',
      {
        entry: join(__dirname, 'functions', 'getUsers.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME: table.tableName,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-dynamodb'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    table.grantReadData(getUsers);
    users.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(getUsers));

    const getProtected = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'ProtectedHandler',
      {
        entry: join(__dirname, 'functions', 'getProtected.ts'),
        handler: 'handler',
        environment: {
          JWT_SECRET_ARN: jwtSecret.secretArn,
          FRONTEND_ORIGIN: frontendOrigin,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-secrets-manager'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    jwtSecret.grantRead(getProtected);

    const protectedRes = api.root.addResource('protected');
    protectedRes.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });
    protectedRes.addMethod(
      'GET',
      new cdk.aws_apigateway.LambdaIntegration(getProtected, {
        proxy: true,
      })
    );

    const postUsers = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'CreateUser',
      {
        entry: join(__dirname, 'functions', 'postUsers.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME: table.tableName,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-dynamodb'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    table.grantWriteData(postUsers);
    users.addMethod(
      'POST',
      new cdk.aws_apigateway.LambdaIntegration(postUsers)
    );

    const putUsers = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'UpdateUser',
      {
        entry: join(__dirname, 'functions', 'putUsers.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME: table.tableName,
          JWT_SECRET_ARN: jwtSecret.secretArn,
          FRONTEND_ORIGIN: frontendOrigin,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-dynamodb'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    table.grantReadWriteData(putUsers);
    jwtSecret.grantRead(putUsers);
    users.addMethod(
      'PUT',
      new cdk.aws_apigateway.LambdaIntegration(putUsers, { proxy: true })
    );

    const postAuthRequestOtp = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'RequestOtp',
      {
        entry: join(__dirname, 'functions', 'postAuthRequestOtp.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME_OTPS: otpTable.tableName,
          OTP_SECRET_ARN: otpSecret.secretArn,
          SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS || '',
          FRONTEND_ORIGIN: frontendOrigin,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/client-sns'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    otpTable.grantWriteData(postAuthRequestOtp);
    otpTable.grantReadData(postAuthRequestOtp);
    postAuthRequestOtp.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: ['*'],
      })
    );
    postAuthRequestOtp.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    const postAuthVerifyOtp = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'VerifyOtp',
      {
        entry: join(__dirname, 'functions', 'postAuthVerifyOtp.ts'),
        handler: 'handler',
        environment: {
          TABLE_NAME_OTPS: otpTable.tableName,
          USERS_TABLE: table.tableName,
          OTP_SECRET_ARN: otpSecret.secretArn,
          JWT_SECRET_ARN: jwtSecret.secretArn,
          MAX_AUTHS_PER_DAY: process.env.MAX_AUTHS_PER_DAY || '4',
          SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS || '',
          FRONTEND_ORIGIN: frontendOrigin,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-dynamodb'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    otpTable.grantReadWriteData(postAuthVerifyOtp);
    table.grantReadWriteData(postAuthVerifyOtp);
    otpSecret.grantRead(postAuthRequestOtp);
    otpSecret.grantRead(postAuthVerifyOtp);
    jwtSecret.grantRead(postAuthVerifyOtp);

    const auth = api.root.addResource('auth');
    const requestOtpRes = auth.addResource('request-otp');
    requestOtpRes.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });
    requestOtpRes.addMethod(
      'POST',
      new cdk.aws_apigateway.LambdaIntegration(postAuthRequestOtp, {
        proxy: true,
      })
    );
    const verifyOtpRes = auth.addResource('verify-otp');
    verifyOtpRes.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });
    verifyOtpRes.addMethod(
      'POST',
      new cdk.aws_apigateway.LambdaIntegration(postAuthVerifyOtp, {
        proxy: true,
      })
    );

    const postAuthLogout = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'Logout',
      {
        entry: join(__dirname, 'functions', 'postAuthLogout.ts'),
        handler: 'handler',
        environment: {
          FRONTEND_ORIGIN: frontendOrigin,
        },
        bundling: {
          minify: true,
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );

    const logoutRes = auth.addResource('postAuthLogout');
    logoutRes.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });
    logoutRes.addMethod(
      'POST',
      new cdk.aws_apigateway.LambdaIntegration(postAuthLogout, { proxy: true })
    );

    new cdk.CfnOutput(this, 'QueueArn', {
      value: queue.queueArn,
      description: 'ARN of the SQS Queue',
      exportName: `${id}-QueueArn`,
    });

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway',
      exportName: `${id}-RestApiUrl`,
    });

    // Daily Sports Scores Lambda
    const dailySportsScores = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'DailySportsScores',
      {
        entry: join(__dirname, 'sports', 'functions', 'dailySportsScores.ts'),
        handler: 'handler',
        environment: {
          RECIPIENT_EMAIL: process.env.SPORTS_RECIPIENT_EMAIL || 'kschloeg@gmail.com',
          SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS || '',
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-ses'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
      }
    );

    // Grant SES permissions to send emails
    dailySportsScores.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // EventBridge rule to trigger daily at 4am CST (10am UTC)
    const dailySportsRule = new cdk.aws_events.Rule(this, 'DailySportsScoresRule', {
      schedule: cdk.aws_events.Schedule.cron({
        minute: '0',
        hour: '10', // 4am CST = 10am UTC
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Trigger daily sports scores check at 4am CST',
    });

    // Add Lambda as target for the rule
    dailySportsRule.addTarget(
      new cdk.aws_events_targets.LambdaFunction(dailySportsScores)
    );

    new cdk.CfnOutput(this, 'DailySportsScoresLambdaArn', {
      value: dailySportsScores.functionArn,
      description: 'ARN of the Daily Sports Scores Lambda',
      exportName: `${id}-DailySportsScoresLambdaArn`,
    });

    // API endpoint to manually trigger sports scores
    const postSportsScoresTrigger = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      'TriggerSportsScores',
      {
        entry: join(__dirname, 'sports', 'functions', 'postSportsScoresTrigger.ts'),
        handler: 'handler',
        environment: {
          JWT_SECRET_ARN: jwtSecret.secretArn,
          FRONTEND_ORIGIN: frontendOrigin,
          SPORTS_LAMBDA_ARN: dailySportsScores.functionArn,
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/client-lambda', '@aws-sdk/client-secrets-manager'],
        },
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      }
    );
    jwtSecret.grantRead(postSportsScoresTrigger);
    dailySportsScores.grantInvoke(postSportsScoresTrigger);

    const sportsResource = api.root.addResource('sports');
    const triggerResource = sportsResource.addResource('trigger');
    triggerResource.addCorsPreflight({
      allowOrigins: [frontendOrigin],
      allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      allowHeaders: cdk.aws_apigateway.Cors.DEFAULT_HEADERS,
      allowCredentials: true,
    });
    triggerResource.addMethod(
      'POST',
      new cdk.aws_apigateway.LambdaIntegration(postSportsScoresTrigger, {
        proxy: true,
      })
    );
  }
}
