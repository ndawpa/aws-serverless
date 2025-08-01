#!/bin/bash

echo "🔍 Debugging Frontend Deployment"
echo "================================"

# Get stack outputs
echo "📋 Getting stack outputs..."
STACK_NAME="TodoInfrastructureStack"

# Get S3 bucket name
S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text 2>/dev/null)

if [ -z "$S3_BUCKET" ] || [ "$S3_BUCKET" == "None" ]; then
    echo "❌ Could not find S3 bucket name"
    exit 1
fi

echo "✅ S3 Bucket: $S3_BUCKET"

# Get CloudFront distribution ID
CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text 2>/dev/null)

if [ -z "$CLOUDFRONT_ID" ] || [ "$CLOUDFRONT_ID" == "None" ]; then
    echo "❌ Could not find CloudFront distribution ID"
    exit 1
fi

echo "✅ CloudFront Distribution ID: $CLOUDFRONT_ID"

# Check S3 bucket contents
echo ""
echo "📦 Checking S3 bucket contents..."
aws s3 ls s3://$S3_BUCKET/ --recursive

# Check S3 bucket website configuration
echo ""
echo "🌐 Checking S3 website configuration..."
aws s3api get-bucket-website --bucket $S3_BUCKET

# Check CloudFront distribution status
echo ""
echo "☁️ Checking CloudFront distribution status..."
aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status' --output text

# Check CloudFront distribution domain
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.DomainName' --output text)
echo "✅ CloudFront Domain: $CLOUDFRONT_DOMAIN"

# Test S3 website endpoint directly
S3_WEBSITE=$(aws s3api get-bucket-website --bucket $S3_BUCKET --query 'WebsiteEndpoint' --output text 2>/dev/null)
if [ ! -z "$S3_WEBSITE" ]; then
    echo ""
    echo "🔗 S3 Website Endpoint: http://$S3_WEBSITE"
    echo "   Try accessing this URL directly to test S3 website hosting"
fi

echo ""
echo "🔧 Troubleshooting Steps:"
echo "1. Check if CloudFront distribution is deployed: $CLOUDFRONT_DOMAIN"
echo "2. Try S3 website endpoint directly: http://$S3_WEBSITE"
echo "3. Check CloudFront cache invalidation status"
echo "4. Verify S3 bucket permissions"

# Check recent CloudFront invalidations
echo ""
echo "🔄 Recent CloudFront invalidations:"
aws cloudfront list-invalidations --distribution-id $CLOUDFRONT_ID --query 'InvalidationList.Items[0:3]' --output table 