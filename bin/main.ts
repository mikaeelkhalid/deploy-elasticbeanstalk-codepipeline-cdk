#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EbCodePipelineStack } from '../stacks';

const app = new cdk.App();

new EbCodePipelineStack(app, 'stack-name');

app.synth();
