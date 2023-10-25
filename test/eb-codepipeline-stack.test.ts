import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as DeployElasticbeanstalkCodepipelineCdk from '../stacks';

test('SQS Queue and SNS Topic Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new DeployElasticbeanstalkCodepipelineCdk.EbCodePipelineStack(
    app,
    'MyTestStack'
  );
  // THEN

  const template = Template.fromStack(stack);
});

