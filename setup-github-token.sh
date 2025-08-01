#!/bin/bash

# Setup GitHub Token for CodePipeline
# This script helps you store your GitHub OAuth token in AWS Secrets Manager

echo "🔧 Setting up GitHub Token for CodePipeline"
echo "=============================================="

# Check if GitHub token is provided as argument
if [ -z "$1" ]; then
    echo "❌ Error: GitHub token not provided"
    echo ""
    echo "Usage: $0 <your-github-token>"
    echo ""
    echo "To get a GitHub token:"
    echo "1. Go to GitHub.com → Settings → Developer settings → Personal access tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Give it a name like 'AWS CodePipeline'"
    echo "4. Select scopes: 'repo' (for private repos) or 'public_repo' (for public repos)"
    echo "5. Copy the generated token"
    echo ""
    echo "Example: $0 ghp_xxxxxxxxxxxxxxxxxxxx"
    exit 1
fi

GITHUB_TOKEN=$1
SECRET_NAME="github-token"

echo "📝 Creating secret in AWS Secrets Manager..."
echo "Secret name: $SECRET_NAME"

# Create the secret
aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "GitHub OAuth token for CodePipeline" \
    --secret-string "{\"token\":\"$GITHUB_TOKEN\"}" \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ GitHub token stored successfully!"
    echo ""
    echo "🎉 You can now deploy your infrastructure:"
    echo "   cd infrastructure"
    echo "   npm run deploy"
    echo ""
    echo "📝 Note: Keep your GitHub token secure and don't share it."
else
    echo "❌ Failed to store GitHub token"
    echo "   Make sure you have AWS CLI configured with appropriate permissions"
    exit 1
fi 