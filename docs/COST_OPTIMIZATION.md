# Cost Optimization Guide for MAIVE UI

## Overview
This document outlines different approaches to optimize AWS infrastructure costs based on user load, with a focus on scenarios with 0-2 users per day.

## Current Infrastructure Cost Analysis

### ECS-based Architecture (Current)
- **Monthly Cost**: ~$40.15
- **Annual Cost**: ~$482
- **Best For**: Production environments, moderate to high usage

### Lambda-based Architecture (Alternative)
- **Monthly Cost**: ~$5-10
- **Annual Cost**: ~$60-120
- **Best For**: Low usage scenarios, development/testing

### Lambda@Edge + CloudFront (Ultra-low-cost)
- **Monthly Cost**: ~$2-5
- **Annual Cost**: ~$24-60
- **Best For**: Very low usage, global distribution

## Dynamic Scaling Strategies

### 1. Enhanced ECS Auto-scaling

The current ECS setup now includes:

- **CPU-based scaling**: Scales based on CPU utilization (target: 70%)
- **Request-based scaling**: Scales based on ALB request count per target
- **Scheduled scaling**: Automatically scales down during low-usage hours
- **Scale to zero**: Can scale down to 0 tasks when no users are active

#### Scheduled Scaling Schedule
- **Scale Down**: 2 AM UTC (night time)
- **Scale Up**: 8 AM UTC (morning)
- **Configurable**: Can be adjusted based on your timezone and usage patterns

#### Benefits
- Reduces costs by 40-60% during off-hours
- Maintains production-grade reliability
- Automatic scaling based on actual usage

### 2. Lambda-based UI

#### Architecture
```
User Request → Lambda Function URL → React UI → R Backend Lambda
```

#### Implementation
- Uses the same Docker image as ECS
- Configured with 512MB memory and 30-second timeout
- Direct HTTP access via Lambda Function URL
- No load balancer required

#### Benefits
- Pay-per-request pricing
- No idle costs
- Automatic scaling
- Simpler infrastructure

#### Limitations
- Cold start latency (1-3 seconds)
- 30-second timeout limit
- Less suitable for long-running sessions

### 3. Lambda@Edge + CloudFront

#### Architecture
```
User Request → CloudFront → Lambda@Edge → S3 Static Assets
```

#### Implementation
- Serves static assets from S3
- Lambda@Edge handles dynamic requests
- Global CDN distribution
- Ultra-low latency

#### Benefits
- Lowest cost option
- Global distribution
- No cold starts for cached content
- Professional CDN performance

#### Limitations
- More complex setup
- Limited to 5-second execution time
- Requires S3 bucket management

## Cost Comparison Matrix

| Scenario | ECS (Current) | Lambda UI | Lambda@Edge |
|----------|---------------|-----------|-------------|
| 0 users/day | $40.15 | $0.00 | $2.00 |
| 1 user/day | $40.15 | $0.50 | $2.50 |
| 2 users/day | $40.15 | $1.00 | $3.00 |
| 10 users/day | $40.15 | $5.00 | $5.00 |
| 100 users/day | $40.15 | $50.00 | $50.00 |

## Implementation Guide

### Option 1: Enhanced ECS (Recommended for Production)

```bash
# Enable scheduled scaling
terraform apply -var="enable_scheduled_scaling=true"

# Monitor scaling behavior
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=maive-ui \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average
```

### Option 2: Lambda UI (Cost Optimization)

```bash
# Enable Lambda UI
terraform apply -var="enable_lambda_ui=true" -var="enable_scheduled_scaling=false"

# Test the Lambda function
aws lambda invoke \
  --function-name maive-ui \
  --payload '{"httpMethod": "GET", "path": "/"}' \
  response.json
```

### Option 3: Lambda@Edge + CloudFront (Ultra-low-cost)

```bash
# Enable Lambda@Edge UI
terraform apply -var="enable_lambda_edge_ui=true" -var="enable_scheduled_scaling=false"

# Deploy static assets to S3
aws s3 sync ./build s3://maive-ui-static-xxxxx/
```

## Migration Strategy

### Phase 1: Implement Enhanced ECS Scaling
- Deploy scheduled scaling policies
- Monitor cost reduction
- Adjust scaling schedules based on usage patterns

### Phase 2: Evaluate Lambda Options
- Test Lambda UI with real traffic
- Measure performance impact
- Calculate actual cost savings

### Phase 3: Full Migration (if beneficial)
- Migrate to chosen Lambda approach
- Update DNS and routing
- Monitor performance and costs

## Monitoring and Alerts

### Cost Monitoring
- AWS Budgets: $100/month limit (already configured)
- CloudWatch Cost Insights
- AWS Cost Explorer

### Performance Monitoring
- Response time alerts
- Error rate monitoring
- User activity detection

### Scaling Metrics
- ECS task count
- Lambda invocation count
- Request patterns

## Best Practices

### For Low Usage (0-2 users/day)
1. **Start with Enhanced ECS**: Maintains production reliability
2. **Enable scheduled scaling**: Reduces costs by 40-60%
3. **Monitor usage patterns**: Adjust scaling schedules accordingly

### For Development/Testing
1. **Use Lambda UI**: Eliminates idle costs
2. **Disable during off-hours**: Complete cost elimination
3. **Simple deployment**: Faster iteration cycles

### For Production with Variable Load
1. **Hybrid approach**: ECS for peak hours, Lambda for low usage
2. **Predictive scaling**: Use ML-based forecasting
3. **Cost-aware scaling**: Balance performance vs. cost

## Troubleshooting

### Common Issues

#### ECS Scaling Problems
- Check CloudWatch metrics
- Verify IAM permissions
- Review scaling policies

#### Lambda Cold Starts
- Use provisioned concurrency (additional cost)
- Implement connection pooling
- Consider Lambda@Edge for static content

#### Cost Spikes
- Review CloudWatch logs
- Check for infinite loops
- Monitor external API calls

## Conclusion

For your current usage pattern (0-2 users/day), the **Enhanced ECS with scheduled scaling** provides the best balance of cost optimization and production reliability. This approach can reduce your monthly costs from ~$40 to ~$20-25 while maintaining the same user experience.

The Lambda-based alternatives offer even greater cost savings but require more careful consideration of performance requirements and user expectations.
