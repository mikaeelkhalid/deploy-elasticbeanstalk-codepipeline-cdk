#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DeployElasticbeanstalkCodepipelineCdkStack } from '../lib/deploy-elasticbeanstalk-codepipeline-cdk-stack';

const app = new cdk.App();
new DeployElasticbeanstalkCodepipelineCdkStack(app, 'DeployElasticbeanstalkCodepipelineCdkStack');
