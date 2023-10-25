import { join } from 'path';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

const configFilePath = join(__dirname, 'config.yaml');
const readConfigFile = readFileSync(configFilePath, 'utf8');
const config = parse(readConfigFile);

let devProps: any;
let prodProps: any;

if (config.environmentType === 'dev') {
  devProps = {
    stackName: config.dev.stackName,
    environmentType: config.environmentType,
    branch: config.dev.branch,
    pipelineName: config.dev.pipelineConfig.name,
    pipelineBucket: config.dev.pipelineBucket,
    githubRepoOwner: config.githubRepoOwner,
    githubRepoName: config.githubRepoName,
    minSize: config.dev.minSize.toString(),
    maxSize: config.dev.maxSize.toString(),
    instanceTypes: config.dev.instanceTypes,
    envName: config.dev.ebEnvName,
    appName: config.dev.ebAppName,
    githubAccessTokenName: config.githubAccessTokenName,
    projectType: config.projectType,
    sslCertificateArn: config.sslCertificateArn,
  };
}
if (config.environmentType === 'prod') {
  prodProps = {
    stackName: config.prod.stackName,
    environmentType: config.environmentType,
    branch: config.prod.branch,
    pipelineName: config.prod.pipelineConfig.name,
    pipelineBucket: config.prod.pipelineBucket,
    githubRepoOwner: config.githubRepoOwner,
    githubRepoName: config.githubRepoName,
    minSize: config.prod.minSize,
    maxSize: config.prod.maxSize,
    instanceTypes: config.prod.instanceTypes,
    envName: config.prod.ebEnvName,
    appName: config.prod.ebAppName,
    githubAccessTokenName: config.githubAccessTokenName,
    projectType: config.projectType,
    sslCertificateArn: config.sslCertificateArn,
  };
}

export { devProps, prodProps };

