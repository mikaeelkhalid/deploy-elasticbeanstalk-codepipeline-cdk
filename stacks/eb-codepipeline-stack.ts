import { CfnOutput, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, Project } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, ElasticBeanstalkDeployAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CfnApplication, CfnApplicationVersion, CfnEnvironment } from 'aws-cdk-lib/aws-elasticbeanstalk';
import { CfnInstanceProfile, ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

const DEFAULT_SIZE = '1';
const DEFAULT_INSTANCE_TYPE = 't3.small';

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
  envVariables?: [
    {
      name: string;
      value: string;
    }
  ];
}

export class EbCodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: EbCodePipelineStackProps) {
    super(scope, id, props);

    /*-----------------------elasticbeanstalk---------------------------*/
    const webAppZipArchive = this._createWebAppZip();
    const app = this._createApp(props);
    const appVersion = this._createAppVersion(app, webAppZipArchive, props);
    const instanceRole = this._createInstanceRole(props);
    const instanceProfileName = this._createInstanceProfile(instanceRole, props);
    const optionSettingProperties = this._createOptionSettingProperties(instanceProfileName, props);
    const ebEnvironment = this._createEbEnvironment(appVersion, optionSettingProperties, props);

    /*--------------------------codepipeline-----------------------------*/
    const { sourceOutput, sourceAction } = this._createSourceAction(props);
    const { buildOutput, buildProject } = this._createBuildProject();
    const buildAction = this._createBuildAction(buildProject, sourceOutput, buildOutput);
    const deployAction = this._createDeployAction(sourceOutput, buildOutput, props);
    this._createPipeline(deployAction, sourceAction, buildAction, props, app, ebEnvironment);
  }

  /*-----------------------elasticbeanstalk---------------------------*/
  private _createWebAppZip() {
    const webAppZipArchive = new Asset(this, 'expressjs-app-zip', {
      path: `${__dirname}/../express-app`,
    });

    return webAppZipArchive;
  }

  private _createApp(props: EbCodePipelineStackProps) {
    const { appName } = props;
    const app = new CfnApplication(this, 'eb-application', {
      applicationName: appName,
    });

    return app;
  }

  private _createAppVersion(app: CfnApplication, webAppZipArchive: Asset, props: EbCodePipelineStackProps) {
    const { appName } = props;
    const appVersionProps = new CfnApplicationVersion(this, 'eb-app-version', {
      applicationName: appName,
      sourceBundle: {
        s3Bucket: webAppZipArchive.s3BucketName,
        s3Key: webAppZipArchive.s3ObjectKey,
      },
    });

    appVersionProps.addDependency(app);

    return appVersionProps;
  }

  private _createInstanceRole(props: EbCodePipelineStackProps) {
    const { appName } = props;
    const instanceRole = new Role(this, `${appName}-aws-elasticbeanstalk-ec2-role`, {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    const managedPolicy = ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier');

    instanceRole.addManagedPolicy(managedPolicy);

    return instanceRole;
  }

  private _createInstanceProfile(instanceRole: Role, props: EbCodePipelineStackProps) {
    const { appName } = props;
    const instanceProfileName = `${appName}-instance-profile`;
    new CfnInstanceProfile(this, instanceProfileName, {
      instanceProfileName: instanceProfileName,
      roles: [instanceRole.roleName],
    });

    return instanceProfileName;
  }

  private _createOptionSettingProperties(instanceProfileName: string, props: EbCodePipelineStackProps) {
    const { minSize, maxSize, instanceTypes, sslCertificateArn, envVariables } = props;
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
      {
        namespace: 'aws:elasticbeanstalk:environment:process:default',
        optionName: 'HealthCheckPath',
        value: '/', // change to the '/' define in your app
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

    if (envVariables) {
      envVariables.forEach((envVar) => {
        optionSettingProperties.push({
          namespace: 'aws:elasticbeanstalk:application:environment',
          optionName: envVar.name,
          value: envVar.value,
        });
      });
    }

    return optionSettingProperties;
  }

  private _createEbEnvironment(
    appVersionProps: CfnApplicationVersion,
    optionSettingProperties: CfnEnvironment.OptionSettingProperty[],
    props: EbCodePipelineStackProps
  ) {
    const { envName, appName } = props;
    const ebEnvironment = new CfnEnvironment(this, 'eb-environment', {
      environmentName: envName,
      applicationName: appName,
      solutionStackName: '64bit Amazon Linux 2 v5.8.7 running Node.js 18',
      optionSettings: optionSettingProperties,
      versionLabel: appVersionProps.ref,
    });

    new CfnOutput(this, 'eb-url-endpoint', {
      value: ebEnvironment.attrEndpointUrl,
      description: 'URL endpoint for the elasticbeanstalk',
    });

    return ebEnvironment;
  }

  /*--------------------------codepipeline-----------------------------*/
  private _createSourceAction(props: EbCodePipelineStackProps) {
    const { githubRepoOwner, githubRepoName, githubAccessTokenName, branch } = props;
    const sourceOutput = new Artifact();
    const sourceAction = new GitHubSourceAction({
      actionName: 'GitHub',
      owner: githubRepoOwner,
      repo: githubRepoName,
      branch: branch,
      oauthToken: SecretValue.secretsManager(githubAccessTokenName),
      output: sourceOutput,
    });

    return {
      sourceOutput,
      sourceAction,
    };
  }

  private _createBuildProject() {
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

    return {
      buildOutput,
      buildProject,
    };
  }

  private _createBuildAction(buildProject: Project, sourceOutput: Artifact, buildOutput: Artifact) {
    const buildAction = new CodeBuildAction({
      actionName: 'CodeBuild',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    return buildAction;
  }

  private _createDeployAction(sourceOutput: Artifact, buildOutput: Artifact, props: EbCodePipelineStackProps) {
    const { envName, appName, projectType } = props;
    const deployAction = new ElasticBeanstalkDeployAction({
      actionName: 'ElasticBeanstalk',
      applicationName: appName,
      environmentName: envName || 'eb-nodejs-app-environment',
      input: projectType === 'ts' ? buildOutput : sourceOutput,
    });

    return deployAction;
  }

  private _createPipeline(
    deployAction: ElasticBeanstalkDeployAction,
    sourceAction: GitHubSourceAction,
    buildAction: CodeBuildAction,
    props: EbCodePipelineStackProps,
    app: CfnApplication,
    ebEnvironment: CfnEnvironment
  ) {
    const { pipelineName, pipelineBucket, projectType } = props;

    const getPipelineBucket = Bucket.fromBucketName(this, 'existing-bucket', pipelineBucket);

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

