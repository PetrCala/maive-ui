DOMAIN="spuriousprecision.com"
REGION="eu-central-1"

# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --validation-method DNS \
  --region $REGION \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"
echo "Set this as CERTIFICATE_ARN in GitHub Secrets"