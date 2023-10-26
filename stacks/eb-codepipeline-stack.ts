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

const DEFAULT_SIZE = '1';
const DEFAULT_INSTANCE_TYPE = 't2.micro';

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
  sslCertificateArn?: string;
}

export class EbCodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: EbCodePipelineStackProps) {
    super(scope, id, props);

    const {
      minSize,
      maxSize,
      instanceTypes,
      envName,
      appName,
      branch,
      pipelineName,
      pipelineBucket,
      githubRepoOwner,
      githubRepoName,
      githubAccessTokenName,
      projectType,
      sslCertificateArn,
    } = props;

    /*-----------------------elasticbeanstalk---------------------------*/

    const webAppZipArchive = new Asset(this, 'expressjs-app-zip', {
      path: `${__dirname}/../express-app`,
    });

    const app = new CfnApplication(this, 'eb-application', {
      applicationName: appName,
    });

    const appVersionProps = new CfnApplicationVersion(this, 'eb-app-version', {
      applicationName: appName,
      sourceBundle: {
        s3Bucket: webAppZipArchive.s3BucketName,
        s3Key: webAppZipArchive.s3ObjectKey,
      },
    });

    appVersionProps.addDependency(app);

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

    const optionSettingProperties: CfnEnvironment.OptionSettingProperty[] = [
      {
        namespace: 'aws:autoscaling:launchconfiguration',
        optionName: 'IamInstanceProfile',
        value: instanceProfileName,
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MinSize',
        value: minSize || DEFAULT_SIZE,
      },
      {
        namespace: 'aws:autoscaling:asg',
        optionName: 'MaxSize',
        value: maxSize || DEFAULT_SIZE,
      },
      {
        namespace: 'aws:ec2:instances',
        optionName: 'InstanceTypes',
        value: instanceTypes || DEFAULT_INSTANCE_TYPE,
      },
    ];

    if (sslCertificateArn) {
      optionSettingProperties.push(
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'LoadBalancerType',
          value: 'application',
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'ListenerEnabled',
          value: 'true',
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'SSLCertificateArns',
          value: sslCertificateArn,
        },
        {
          namespace: 'aws:elbv2:listener:443',
          optionName: 'Protocol',
          value: 'HTTPS',
        }
      );
    }

    const ebEnvironment = new CfnEnvironment(this, 'eb-environment', {
      environmentName: envName,
      applicationName: appName,
      solutionStackName: '64bit Amazon Linux 2 v5.8.0 running Node.js 18',
      optionSettings: optionSettingProperties,
      versionLabel: appVersionProps.ref,
    });

    new CfnOutput(this, 'eb-url-endpoint', {
      value: ebEnvironment.attrEndpointUrl,
      description: 'URL endpoint for the elasticbeanstalk',
    });

    /*-----------------------codepipeline---------------------------*/

    const sourceOutput = new Artifact();
    const sourceAction = new GitHubSourceAction({
      actionName: 'GitHub',
      owner: githubRepoOwner,
      repo: githubRepoName,
      branch: branch,
      oauthToken: SecretValue.secretsManager(githubAccessTokenName),
      output: sourceOutput,
    });

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

    const deployAction = new ElasticBeanstalkDeployAction({
      actionName: 'ElasticBeanstalk',
      applicationName: appName,
      environmentName: envName || 'eb-nodejs-app-environment',
      input: projectType === 'ts' ? buildOutput : sourceOutput,
    });

    const getPipelineBucket = Bucket.fromBucketName(
      this,
      'existing-bucket',
      pipelineBucket
    );

    const jsProject = [
      { stageName: 'Source', actions: [sourceAction] },
      { stageName: 'Deploy', actions: [deployAction] },
    ];

    const tsProject = [
      { stageName: 'Source', actions: [sourceAction] },
      { stageName: 'Build', actions: [buildAction] },
      { stageName: 'Deploy', actions: [deployAction] },
    ];

    const stages = projectType === 'ts' ? tsProject : jsProject;

    const codePipeline = new Pipeline(this, 'codepipeline', {
      pipelineName: pipelineName,
      artifactBucket: getPipelineBucket,
      stages,
    });

    codePipeline.node.addDependency(app, ebEnvironment);
  }
}

