// Domain Configuration
// Update these values with your actual domain information

export const domainConfig = {
  // Set to false to disable custom domain and use CloudFront default
  enableCustomDomain: true,
  
  // Your main domain (e.g., 'example.com')
  // Only used if enableCustomDomain is true
  domainName: 'aws.guiadodevops.com',
  
  // Optional subdomain (e.g., 'todo' for 'todo.example.com')
  // Only used if enableCustomDomain is true
  subdomain: 'todo',
  
  // Region where you want to create the certificate
  // Must be us-east-1 for CloudFront
  region: 'us-east-1',
};

// Example configurations:
// 
// For no custom domain (use CloudFront default):
// enableCustomDomain: false
// Result: https://d2ksvlt2ssahc3.cloudfront.net
//
// For root domain:
// enableCustomDomain: true
// domainName: 'myapp.com'
// subdomain: '' (empty string)
// Result: https://myapp.com
//
// For subdomain:
// enableCustomDomain: true
// domainName: 'myapp.com'
// subdomain: 'todo'
// Result: https://todo.myapp.com 