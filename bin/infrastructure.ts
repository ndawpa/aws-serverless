#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TodoInfrastructureStack } from '../lib/todo-infrastructure-stack';

const app = new cdk.App();
new TodoInfrastructureStack(app, 'TodoInfrastructureStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});