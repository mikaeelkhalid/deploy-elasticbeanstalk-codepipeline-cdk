import { CfnOutput, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, Project } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
  CodeBuildAction,
  ElasticBeanstalkDeployAction,
  GitHubSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import {
  CfnApplication,
  CfnApplicationVersion,
  CfnEnvironment,
} from 'aws-cdk-lib/aws-elasticbeanstalk';
import {
  CfnInstanceProfile,
  ManagedPolicy,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

export interface EbCodePipelineStackProps extends StackProps {
  minSize?: string;
  maxSize?: string;
  instanceTypes?: string;
  envName: string;
  appName: string;
  branch: string;
  pipelineName: string;
  pipelineBucket: string;
  githubRepoOwner: string;
  githubRepoName: string;
  githubAccessTokenName: string;
  projectType: string;
}

export class EbCodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: EbCodePipelineStackProps) {
    super(scope, id, props);

    /*-----------------------elasticbeanstalk-----------------------------*/

    // construct an S3 asset Zip from directory up.
    const webAppZipArchive = new Asset(this, 'expressjs-app-zip', {
      path: `${__dirname}/../express-app`,
    });

    // create a elasticbeanstalk app.
    const appName = props.appName;
    const app = new CfnApplication(this, 'eb-application', {
      applicationName: appName,
    });

    // create an app version from the S3 asset defined above
    const appVersionProps = new CfnApplicationVersion(this, 'eb-app-version', {
      applicationName: appName,
      sourceBundle: {
        s3Bucket: webAppZipArchive.s3BucketName,
        s3Key: webAppZipArchive.s3ObjectKey,
      },
    });

    // make sure that elasticbeanstalk app exists before creating an app version
    appVersionProps.addDependency(app);

    // create role and instance profile
    const instanceRole = new Role(
      this,
      `${appName}-aws-elasticbeanstalk-ec2-role`,
      {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      }
    );

    const managedPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'AWSElasticBeanstalkWebTier'
    );

    instanceRole.addManagedPolicy(managedPolicy);

    const instanceProfileName = `${appName}-instance-profile`;

    const instanceProfile = new CfnInstanceProfile(this, instanceProfileName, {
      instanceProfileName: instanceProfileName,
      roles: [instanceRole.roleName],
    });

    // options settings which can be configured as
    const optionSettingProperties: CfnEnvironment.OptionSettingProperty[] = [
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'IamInstanceProfile',
        value: instanceProfileName,
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MinSize',
        value: props?.maxSize ?? '1',
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MaxSize',
        value: props?.maxSize ?? '1',
      },
      {
        namespace: 'aws:ec2:instances',
        optionName: 'InstanceTypes',
        value: props?.instanceTypes ?? 't2.micro',
      },
    ];

    // create an elasticbeanstalk environment to run the application
    const ebEnvironment = new CfnEnvironment(this, 'eb-environment', {
      environmentName: props.envName,
      applicationName: app.applicationName || appName,
      solutionStackName: '64bit Amazon Linux 2 v5.8.0 running Node.js 18',
      optionSettings: optionSettingProperties,
      versionLabel: appVersionProps.ref,
    });

    new CfnOutput(this, 'eb-url-endpoint', {
      value: ebEnvironment.attrEndpointUrl,
      description: 'url endpoint for the elasticbeanstalk',
    });

    /*-----------------------codepipeline-------------------------------*/

    // define the github source.
    const sourceOutput = new Artifact();
    const sourceAction = new GitHubSourceAction({
      actionName: 'GitHub',
      owner: props.githubRepoOwner,
      repo: props.githubRepoName,
      branch: props.branch,
      oauthToken: SecretValue.secretsManager(props.githubAccessTokenName),
      output: sourceOutput,
    });

    // define the codebuild project.
    const buildOutput = new Artifact();
    const buildProject = new Project(this, 'codebuild-project', {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: ['npm install'],
          },
          build: {
            commands: ['npm run build'],
          },
        },
        artifacts: {
          files: ['**/*'],
        },
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
      },
    });

    const buildAction = new CodeBuildAction({
      actionName: 'CodeBuild',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // define the deployment action.
    const deployAction = new ElasticBeanstalkDeployAction({
      actionName: 'ElasticBeanstalk',
      applicationName: appName,
      environmentName: props?.envName ?? 'eb-nodejs-app-environment',
      input: props.projectType === 'ts' ? buildOutput : sourceOutput,
    });

    const getPipelineBucket = Bucket.fromBucketName(
      this,
      'ExistingBucket',
      props.pipelineBucket
    );

    const jsProject = [
      {
        stageName: 'Source',
        actions: [sourceAction],
      },
      {
        stageName: 'Deploy',
        actions: [deployAction],
      },
    ];

    const tsProject = [
      {
        stageName: 'Source',
        actions: [sourceAction],
      },
      {
        stageName: 'Build',
        actions: [buildAction],
      },
      {
        stageName: 'Deploy',
        actions: [deployAction],
      },
    ];

    const getStages = props.projectType === 'ts' ? tsProject : jsProject;

    // construct the codepipeline.
    const codePipeline = new Pipeline(this, 'codepipeline', {
      pipelineName: props.pipelineName,
      artifactBucket: getPipelineBucket,
      stages: getStages,
    });

    codePipeline.node.addDependency(app, ebEnvironment);
  }
}

