#!/bin/bash

echo "🌐 Setting up Custom Domain for Todo App"
echo "========================================"

# Check if domain config exists
if [ ! -f "domain-config.ts" ]; then
    echo "❌ domain-config.ts not found"
    exit 1
fi

echo "📋 Current domain configuration:"
echo "--------------------------------"
cat domain-config.ts

echo ""
echo "🔧 To set up your custom domain:"
echo ""
echo "1. 📝 Edit domain-config.ts:"
echo "   - Set domainName to your actual domain (e.g., 'myapp.com')"
echo "   - Set subdomain if desired (e.g., 'todo' for 'todo.myapp.com')"
echo ""
echo "2. 🌍 Ensure your domain is managed by Route 53:"
echo "   - Go to AWS Console → Route 53 → Hosted zones"
echo "   - Your domain should be listed there"
echo "   - If not, you'll need to transfer or create a hosted zone"
echo ""
echo "3. 🚀 Deploy the infrastructure:"
echo "   npx cdk deploy"
echo ""
echo "4. ⏳ Wait for certificate validation:"
echo "   - AWS will create DNS records for certificate validation"
echo "   - This can take 5-30 minutes"
echo ""
echo "5. 🎉 Access your app:"
echo "   - Your app will be available at: https://your-domain.com"
echo ""

# Check if domain is configured
if grep -q "your-domain.com" domain-config.ts; then
    echo "⚠️  WARNING: You still need to update domain-config.ts with your actual domain!"
    echo ""
    echo "Example:"
    echo "domainName: 'myapp.com',"
    echo "subdomain: 'todo',"
    echo ""
fi

echo "📚 Additional Resources:"
echo "- Route 53 Hosted Zones: https://console.aws.amazon.com/route53/v2/hostedzones"
echo "- Certificate Manager: https://console.aws.amazon.com/acm/home"
echo "- CloudFront Distributions: https://console.aws.amazon.com/cloudfront/v3/home" 