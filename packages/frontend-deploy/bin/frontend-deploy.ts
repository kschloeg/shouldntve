#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FrontendDeployStack } from '../lib/frontend-deploy-stack';

const app = new cdk.App();
new FrontendDeployStack(app, 'FrontendDeployStack', {
  env: { account: '765868434033', region: 'us-east-1' },
});
