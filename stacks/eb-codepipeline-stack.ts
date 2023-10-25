import { Stack, StackProps } from 'aws-cdk-lib';
import { CfnApplication } from 'aws-cdk-lib/aws-elasticbeanstalk';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

export class EbCodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // construct an S3 asset Zip from directory up.
    const webAppZipArchive = new Asset(this, 'expressjs-app-zip', {
      path: `${__dirname}/../express-app`,
    });

    // create a elasticbeanstalk app.
    const appName = 'expressjs-eb-app';
    const app = new CfnApplication(this, 'application', {
      applicationName: appName,
    });
  }
}

