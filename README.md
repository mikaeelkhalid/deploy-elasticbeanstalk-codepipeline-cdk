# AWS Elastic Beanstalk CodePipeline Deployment with CDK

[![Mikaeel Khalid](https://badgen.now.sh/badge/by/mikaeelkhalid/purple)](https://github.com/mikaeelkhalid)

This repository provides a robust setup for deploying Node.js (will work with both TS and JS) type of applications onto AWS
Elastic Beanstalk using AWS CodePipeline and the AWS Cloud Development Kit (CDK).

## ✨ Features

- 🚀 Automated Deployment: Seamless deployment of an Express.js application onto Elastic Beanstalk.
- 🔁 CI/CD Integration: Fully integrated with CodePipeline for a smooth CI/CD experience.
- 📦 CodeBuild Integration: Uses AWS CodeBuild to install application dependencies and prepare it for deployment.
- 📡 CodeCommit or GitHub Integration: Fetches the source code directly from a specified CodeCommit or GitHub repository.

## 🚀 Getting Started

### Prerequisites

- AWS Command Line Interface (CLI) installed and configured.
- AWS Cloud Development Kit (CDK) CLI installed.
- Node.js and npm installed on your local machine.
- A GitHub or CodeCommit repository containing the source code of your Node.js application (ts or js).

### Setup & Deployment

1. **Rename `config.sample.yaml` to `config.yaml`**: Update this file with the necessary details, including the Git repository
   name, its owner, your GitHub access token, if repo is GitHub and any environment-specific configurations.

2. **Bootstrap the AWS CDK**: If this is your first time using CDK on your AWS account or region, initialize your environment
   with:

   ```bash
   cdk bootstrap
   ```

3. **Deploy the CDK Stack**: Use the CDK CLI to deploy your stack:

   ```bash
   cdk deploy
   ```

4. **Push Changes & Watch Magic Happen**: With your pipeline now set up, any subsequent pushes to your specified GitHub branch
   will trigger your pipeline. This will rebuild your application and redeploy it to Elastic Beanstalk.

### Cleanup

To ensure you don't continue incurring AWS charges, remember to destroy the resources when not in use:

```bash
cdk destroy
```

## 🛡️ Note

Ensure your IAM permissions are appropriately set to allow the CDK to manage AWS resources on your behalf. Additionally, ensure
that your GitHub token has the right permissions, especially for accessing the repository and triggering webhooks.

## 🙌 Contribute

Contributions are more than welcome! Feel free to fork this repository, make your improvements, and then submit them back through
a pull request.

