DOMAIN="spuriousprecision.com"

AWS_REGION=$(aws configure get region)
if [ -z "$AWS_REGION" ]; then
  echo "AWS region is not configured. Please set the region and try again."
  exit 1
fi


# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --validation-method DNS \
  --region $AWS_REGION \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"
echo "Set this as CERTIFICATE_ARN in GitHub Secrets"