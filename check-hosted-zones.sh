#!/bin/bash

echo "🔍 Checking Route 53 Hosted Zones"
echo "================================="

echo "📋 Listing all hosted zones in your AWS account:"
aws route53 list-hosted-zones --query 'HostedZones[].{Name:Name,Id:Id,PrivateZone:Config.PrivateZone}' --output table

echo ""
echo "🔍 Looking for hosted zones that might match your domain..."

# Check for exact match
echo "Exact match for 'aws.guiadodevops.com':"
aws route53 list-hosted-zones --query 'HostedZones[?Name==`aws.guiadodevops.com.`].{Name:Name,Id:Id}' --output table

# Check for parent domain
echo ""
echo "Parent domain 'guiadodevops.com':"
aws route53 list-hosted-zones --query 'HostedZones[?Name==`guiadodevops.com.`].{Name:Name,Id:Id}' --output table

echo ""
echo "💡 Solutions:"
echo "1. If you see a hosted zone for 'guiadodevops.com', update domain-config.ts to use that"
echo "2. If no hosted zone exists, you need to create one in Route 53"
echo "3. If you want to use a different domain, update domain-config.ts" 