#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EbCodePipelineStack } from '../stacks';
import { devProps, prodProps } from '../config';

const app = new cdk.App();

if (devProps?.stackName?.length) {
  const devStackName = devProps.stackName;
  new EbCodePipelineStack(app, devStackName, devProps);
} else {
  const prodStackName = prodProps?.stackName;
  new EbCodePipelineStack(app, prodStackName, prodProps);
}

app.synth();

