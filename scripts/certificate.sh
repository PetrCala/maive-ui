#!/bin/bash

# Default domain suggestion
DEFAULT_DOMAIN="spuriousprecision.com"

# Prompt user for domain with default suggestion
echo "Enter the domain name for the SSL certificate:"
echo "Default: $DEFAULT_DOMAIN"
echo "Press Enter to use default, or type a different domain:"
read -p "Domain: " DOMAIN

# Use default if no input provided
if [ -z "$DOMAIN" ]; then
  DOMAIN="$DEFAULT_DOMAIN"
  echo "Using default domain: $DOMAIN"
else
  echo "Using domain: $DOMAIN"
fi

# Validate domain format (basic check)
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
  echo "Error: Invalid domain format. Please enter a valid domain name."
  exit 1
fi

AWS_REGION=$(aws configure get region)
if [ -z "$AWS_REGION" ]; then
  echo "AWS region is not configured. Please set the region and try again."
  exit 1
fi

echo "Requesting certificate for domain: $DOMAIN in region: $AWS_REGION"

# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --validation-method DNS \
  --region $AWS_REGION \
  --query 'CertificateArn' \
  --output text)

if [ $? -eq 0 ] && [ -n "$CERT_ARN" ]; then
  echo "✅ Certificate requested successfully!"
  echo "Certificate ARN: $CERT_ARN"
  echo ""
  echo "Next steps:"
  echo "1. Add this ARN to GitHub Secrets as CERTIFICATE_ARN"
  echo "2. Complete DNS validation in AWS Certificate Manager"
  echo "3. Redeploy your infrastructure to use HTTPS"
else
  echo "❌ Failed to request certificate. Please check your AWS credentials and try again."
  exit 1
fi