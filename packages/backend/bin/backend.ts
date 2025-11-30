#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack";

const app = new cdk.App();
new BackendStack(app, "BackendStack", {
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account: "765868434033", region: "us-east-1" },
});
