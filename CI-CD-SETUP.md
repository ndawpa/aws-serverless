# CI/CD Pipeline Setup for Todo Frontend

This document explains how to set up and use the automated CI/CD pipeline for deploying your frontend to AWS S3 and CloudFront.

## 🏗️ **Infrastructure Overview**

The CI/CD pipeline includes:

- **AWS CodePipeline**: Orchestrates the entire deployment process
- **AWS CodeBuild**: Builds and tests your frontend application
- **GitHub**: Source code repository (your existing GitHub repo)
- **AWS S3**: Stores built artifacts and hosts the website
- **Amazon CloudFront**: CDN for fast global delivery
- **AWS IAM**: Manages permissions and security

## 🚀 **Pipeline Flow**

```
GitHub Repository → CodePipeline → CodeBuild → S3 → CloudFront
        ↓              ↓            ↓        ↓        ↓
    Git Push → Source Stage → Build Stage → Deploy → Cache → Global CDN
```

## 📋 **Prerequisites**

1. **AWS CLI configured** with appropriate permissions
2. **CDK deployed** with the CI/CD infrastructure
3. **Git installed** locally

## 🛠️ **Setup Instructions**

### 1. Deploy the Infrastructure

```bash
cd infrastructure
npm run build
cdk deploy
```

### 2. Set Up GitHub Token

Before deploying, you need to store your GitHub OAuth token in AWS Secrets Manager:

```bash
# Run the setup script (replace with your actual GitHub token)
./setup-github-token.sh ghp_your_github_token_here
```

**To get a GitHub token:**
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Give it a name like "AWS CodePipeline"
4. Select scopes: "repo" (for private repos) or "public_repo" (for public repos)
5. Copy the generated token

### 3. Deploy the Infrastructure

```bash
cd infrastructure
npm run build
npm run deploy
```

### 4. Get Repository Information

After deployment, note the outputs:
- **Repository Name**: `todo-frontend`
- **Pipeline Name**: `todo-frontend-pipeline`
- **Build Project**: `todo-frontend-build`

### 5. Set Up Your GitHub Repository

Create a new repository on GitHub or use an existing one:

```bash
# Create a new repository on GitHub (via web interface)
# Then clone it locally
git clone https://github.com/your-username/todo-frontend.git
cd todo-frontend

# Copy your frontend files
cp -r ../frontend/* .

# Add and commit files
git add .
git commit -m "Initial frontend deployment"

# Push to trigger the pipeline
git push origin main
```

## 🔄 **Pipeline Stages**

### **Stage 1: Source**
- Monitors the GitHub repository
- Triggers on code changes to the `main` branch
- Downloads source code for processing

### **Stage 2: Build**
- Installs Node.js 18 runtime
- Runs `npm ci` to install dependencies
- Executes `npm run build` to create production build
- Validates build artifacts

### **Stage 3: Deploy**
- Syncs built files to S3 bucket
- Creates CloudFront invalidation for cache refresh
- Updates the live website

## 📁 **Repository Structure**

Your GitHub repository should contain:

```
todo-frontend/
├── src/
│   ├── components/
│   ├── services/
│   └── App.tsx
├── public/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── buildspec.yml
└── README.md
```

## 🔧 **Configuration Files**

### `buildspec.yml`
Located in your repository root, this file tells CodeBuild how to build your application:

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm ci
  pre_build:
    commands:
      - npm run build
  post_build:
    commands:
      - aws s3 sync dist/ s3://$WEBSITE_BUCKET --delete
      - aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
```

## 🔧 **Configuration**

### **GitHub Repository Settings**

Make sure your GitHub repository has:
- **Public repository** (or private with proper token permissions)
- **Main branch** as the default branch
- **buildspec.yml** file in the root directory

### **Pipeline Configuration**

The pipeline is configured to:
- Monitor the `main` branch
- Use Node.js 18 for building
- Deploy to S3 and invalidate CloudFront cache
- Handle SPA routing with proper error responses

## 📊 **Monitoring & Troubleshooting**

### **View Pipeline Status**
```bash
# List pipelines
aws codepipeline list-pipelines

# Get pipeline state
aws codepipeline get-pipeline-state --name todo-frontend-pipeline

# Get pipeline details
aws codepipeline get-pipeline --name todo-frontend-pipeline
```

### **View Build Logs**
```bash
# List build projects
aws codebuild list-projects

# Get build history
aws codebuild list-builds-for-project --project-name todo-frontend-build

# Get specific build details
aws codebuild batch-get-builds --ids build-id-here
```

### **Common Issues**

1. **Build Fails**: Check CodeBuild logs for npm or build errors
2. **Deploy Fails**: Verify S3 bucket permissions and CloudFront distribution ID
3. **Pipeline Stuck**: Check IAM roles and permissions
4. **Cache Issues**: Verify CloudFront invalidation is working

## 🔐 **Security Features**

- **Private S3 Bucket**: Website files are not publicly accessible
- **CloudFront OAI**: Secure access to S3 through Origin Access Identity
- **IAM Roles**: Least privilege access for all services
- **HTTPS Only**: All traffic encrypted in transit

## 💰 **Cost Optimization**

- **CodeBuild**: Pay only for build minutes used
- **CodePipeline**: First pipeline is free, additional pipelines cost $1/month
- **GitHub**: Free for public repositories
- **S3**: Pay for storage and requests
- **CloudFront**: Pay for data transfer and requests

## 🧹 **Cleanup**

To remove all CI/CD resources:

```bash
cd infrastructure
cdk destroy
```

This will remove:
- CodePipeline
- CodeBuild project
- GitHub token from Secrets Manager
- Pipeline artifact bucket
- All associated IAM roles and policies

## 📞 **Support**

For issues with:
- **CDK Deployment**: Check CloudFormation console
- **Pipeline Execution**: Check CodePipeline console
- **Build Failures**: Check CodeBuild console
- **GitHub Access**: Check GitHub token permissions and repository settings

## 🎯 **Next Steps**

1. **Set up monitoring**: Add CloudWatch alarms for pipeline failures
2. **Add testing**: Include unit and integration tests in the build
3. **Environment separation**: Create staging and production pipelines
4. **Security scanning**: Add code security scanning to the pipeline
5. **Performance testing**: Include Lighthouse or similar performance tests 