# Lambda R Backend Migration

## 🎯 Overview

This directory contains the Lambda migration for your R backend, replacing the expensive ECS Fargate service with a cost-effective Lambda function.

## 💰 Cost Benefits

### Before (ECS Fargate)

- **R Backend Task**: ~$1.00/day ($30/month)
- **R Backend ALB**: ~$0.50/day ($15/month)
- **Total R Backend**: ~$45/month

### After (Lambda)

- **Lambda Function**: ~$0.20 per million requests
- **Your usage**: Likely <$1/month
- **Total R Backend**: ~$1/month
- **Savings**: **95%+ cost reduction**

## 🏗️ Architecture

```
Frontend (React) → Lambda Function URL → R Backend (Lambda)
```

**Key Changes:**

- ❌ **Removed**: ECS R backend service
- ❌ **Removed**: R backend ALB
- ❌ **Removed**: R backend security groups
- ✅ **Added**: Lambda function with container image
- ✅ **Added**: Lambda function URL for direct HTTP access
- ✅ **Added**: CloudWatch monitoring and alarms

## 📁 Files

- **`index.R`** - Main Lambda handler (replaces plumber.R)
- **`maive_model.R`** - MAIVE model logic (adapted from original)
- **`funnel_plot.R`** - Funnel plot generation (copied from original)
- **`Dockerfile`** - Container image definition
- **`build.sh`** - Build and deploy script
- **`migrate.sh`** - Migration guide script

## 🚀 Migration Steps

### Phase 1: Build Lambda Container

```bash
cd lambda-r-backend
chmod +x build.sh
./build.sh
```

### Phase 2: Apply Terraform

```bash
# Foundation stack (ECR repository)
cd terraform/stacks/prod-foundation
terraform plan
terraform apply

# Runtime stack (Lambda function)
cd ../prod-runtime
terraform plan
terraform apply
```

### Phase 3: Test Lambda Backend

```bash
# Get Lambda function URL
aws lambda get-function-url-config \
  --function-name maive-r-backend \
  --profile kiroku \
  --region eu-central-1 \
  --query FunctionUrl \
  --output text

# Test ping endpoint
curl <LAMBDA_URL>/ping
```

### Phase 4: Clean Up (Optional)

After confirming Lambda works:

1. Comment out R backend resources in `ecs.tf`
2. Comment out R backend ALB in `alb.tf`
3. Comment out R backend security groups in `sg.tf`
4. Apply Terraform changes

## 🔧 Configuration

### Lambda Settings

- **Memory**: 1024MB (same as current ECS task)
- **Timeout**: 600 seconds (10 minutes)
- **Runtime**: `provided.al2` (custom container)
- **Handler**: `index.handler`

### Environment Variables

- **`R_HOME`**: `/usr/lib64/R`
- **`NEXT_PUBLIC_R_API_URL`**: Automatically updated to Lambda function URL

## 📊 Monitoring

### CloudWatch Metrics

- **Invocations**: Number of function calls
- **Errors**: Function errors
- **Duration**: Execution time
- **Throttles**: Rate limiting events

### Alarms

- **Error Rate**: Alerts when errors occur
- **High Duration**: Alerts when execution time is high

### Dashboard

- **Lambda R Backend Dashboard**: Real-time metrics and logs

## 🧪 Testing

### Health Check

```bash
curl <LAMBDA_URL>/ping
# Expected: {"status":"ok","time":"..."}
```

### Echo Test

```bash
curl "<LAMBDA_URL>/echo?msg=hello"
# Expected: {"msg":"The message is: 'hello'"}
```

### Model Execution

```bash
curl -X POST <LAMBDA_URL>/run-model \
  -H "Content-Type: application/json" \
  -d '{"data":[...],"parameters":{...}}'
```

## 🔒 Security

### Current Setup

- **Public Access**: Lambda function URL is publicly accessible
- **CORS**: Configured to allow all origins
- **No Authentication**: As requested (no sensitive data)

### Future Enhancements (Optional)

- **API Gateway**: Add rate limiting and authentication
- **IAM**: Restrict access to specific users/roles
- **VPC**: Place Lambda in private subnets

## 🚨 Troubleshooting

### Common Issues

1. **Container Build Fails**
   - Check Docker is running
   - Verify AWS credentials
   - Check ECR repository exists

2. **Lambda Execution Errors**
   - Check CloudWatch logs
   - Verify R packages are installed
   - Check memory/timeout settings

3. **Frontend Connection Issues**
   - Verify Lambda function URL is correct
   - Check CORS configuration
   - Test Lambda endpoints directly

### Debug Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/maive-r-backend \
  --profile kiroku \
  --region eu-central-1

# Test Lambda function
aws lambda invoke \
  --function-name maive-r-backend \
  --payload '{"httpMethod":"GET","path":"/ping"}' \
  --profile kiroku \
  --region eu-central-1 \
  response.json
```

## 📈 Performance

### Expected Results

- **Cold Start**: ~2-5 seconds (first invocation)
- **Warm Start**: ~100-500ms (subsequent invocations)
- **Memory Usage**: Optimized for 1024MB allocation
- **Concurrent Requests**: Handles your 0-20 user spikes automatically

### Optimization Tips

- **Keep Lambda Warm**: Use Provisioned Concurrency for consistent performance
- **Memory Tuning**: Increase memory for faster execution (costs more but faster)
- **Package Optimization**: Remove unused R packages

## 🎉 Success Metrics

### Cost Reduction

- **Target**: 90%+ reduction in backend costs
- **Current**: $45/month → $1/month
- **Annual Savings**: ~$528

### Performance

- **Response Time**: Same or better than ECS
- **Reliability**: 99.9%+ uptime
- **Scalability**: Automatic scaling for traffic spikes

## 📞 Support

If you encounter issues:

1. Check CloudWatch logs first
2. Verify Terraform configuration
3. Test Lambda endpoints directly
4. Review this README for troubleshooting steps

---

**Ready to save 95% on your backend costs? Let's migrate! 🚀**
