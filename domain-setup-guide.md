# 🌐 Custom Domain Setup Guide

## 🎯 What This Does

The CDK infrastructure will now automatically:

1. ✅ **Create a Route 53 hosted zone** for `aws.guiadodevos.com`
2. ✅ **Create an SSL certificate** for `todo.aws.guiadodevos.com`
3. ✅ **Configure CloudFront** with your custom domain
4. ✅ **Create DNS records** pointing to CloudFront

## 🚀 Deploy the Infrastructure

```bash
npx cdk deploy
```

## 📋 After Deployment

### 1. **Get the Nameservers**

After deployment, you'll see outputs like:
```
Outputs:
TodoInfrastructureStack.NameServers = ns-1234.awsdns-12.com, ns-5678.awsdns-34.net, ...
TodoInfrastructureStack.CustomDomain = todo.platformengineer.com.br
```

### 2. **Configure Your Domain Registrar**

Go to your domain registrar (where you bought `aws.guiadodevos.com`) and:

1. **Find DNS/Nameserver settings**
2. **Replace the current nameservers** with the AWS nameservers from the output
3. **Save the changes**

### 3. **Wait for DNS Propagation**

- **Nameserver changes**: 24-48 hours
- **SSL certificate validation**: 5-30 minutes
- **DNS propagation**: 5-60 minutes

## 🌐 Your App Will Be Available At

**https://todo.aws.guiadodevos.com**

## ⚠️ Important Notes

1. **Domain Ownership**: You must own `aws.guiadodevos.com`
2. **Registrar Access**: You need access to change nameservers
3. **Patience**: DNS changes can take up to 48 hours

## 🔧 Troubleshooting

### If deployment fails:
- Check that you own the domain
- Ensure you have Route 53 permissions in AWS

### If domain doesn't work after deployment:
- Verify nameservers are updated in your registrar
- Wait for DNS propagation
- Check CloudFront distribution status

## 📞 Support

If you need help:
1. Check the CDK deployment outputs
2. Verify nameserver configuration
3. Wait for DNS propagation 