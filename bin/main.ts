#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EbCodePipelineStack } from '../stacks';
import { devProps, prodProps, env } from '../config';

const app = new cdk.App();

if (devProps?.stackName?.length) {
  const devStackName = devProps.stackName;

  new EbCodePipelineStack(app, devStackName, {
    ...devProps,
    description: 'eb-codepipeline dev environment stack',
    env,
  });
} else {
  const prodStackName = prodProps.stackName;

  new EbCodePipelineStack(app, prodStackName, {
    ...prodProps,
    description: 'eb-codepipeline prod environment stack',
    env,
  });
}

app.synth();

