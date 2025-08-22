#!/bin/bash

# Cost Optimization Script for MAIVE UI
# This script helps implement and monitor cost optimization strategies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT="maive"
REGION="eu-central-1"
PROFILE="kiroku"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check AWS CLI and profile
check_aws_setup() {
    print_status "Checking AWS CLI setup..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity --profile $PROFILE &> /dev/null; then
        print_error "AWS profile '$PROFILE' is not configured or invalid."
        exit 1
    fi
    
    print_success "AWS CLI setup verified"
}

# Function to show current costs
show_current_costs() {
    print_status "Fetching current cost information..."
    
    # Get current month costs
    CURRENT_MONTH=$(date +%Y-%m)
    START_DATE="${CURRENT_MONTH}-01"
    END_DATE=$(date +%Y-%m-%d)
    
    print_status "Costs for $CURRENT_MONTH (so far):"
    
    # Note: This requires Cost Explorer to be enabled
    if aws ce get-cost-and-usage \
        --profile $PROFILE \
        --time-period Start=$START_DATE,End=$END_DATE \
        --granularity MONTHLY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --query 'ResultsByTime[0].Groups[?Metrics.BlendedCost.Amount>`0`]' \
        --output table 2>/dev/null; then
        print_success "Cost information retrieved"
    else
        print_warning "Cost Explorer not enabled or no costs found"
    fi
}

# Function to show ECS scaling status
show_ecs_scaling() {
    print_status "Checking ECS scaling status..."
    
    CLUSTER_NAME="${PROJECT}-cluster"
    SERVICE_NAME="${PROJECT}-ui"
    
    # Get current ECS service status
    if aws ecs describe-services \
        --profile $PROFILE \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --query 'services[0].{DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}' \
        --output table 2>/dev/null; then
        print_success "ECS service status retrieved"
    else
        print_warning "ECS service not found or error occurred"
    fi
    
    # Get scaling policies
    print_status "Checking auto-scaling policies..."
    if aws application-autoscaling describe-scaling-policies \
        --profile $PROFILE \
        --service-namespace ecs \
        --resource-id "service/$CLUSTER_NAME/$SERVICE_NAME" \
        --query 'ScalingPolicies[].{PolicyName:PolicyName,PolicyType:PolicyType}' \
        --output table 2>/dev/null; then
        print_success "Scaling policies retrieved"
    else
        print_warning "No scaling policies found"
    fi
}

# Function to show CloudWatch metrics
show_cloudwatch_metrics() {
    print_status "Fetching recent CloudWatch metrics..."
    
    # Get CPU utilization for the last hour
    START_TIME=$(date -d '1 hour ago' --iso-8601)
    END_TIME=$(date --iso-8601)
    
    print_status "CPU utilization for the last hour:"
    if aws cloudwatch get-metric-statistics \
        --profile $PROFILE \
        --namespace AWS/ECS \
        --metric-name CPUUtilization \
        --dimensions Name=ServiceName,Value="${PROJECT}-ui" \
        --start-time $START_TIME \
        --end-time $END_TIME \
        --period 300 \
        --statistics Average \
        --query 'Datapoints[].{Timestamp:Timestamp,Average:Average}' \
        --output table 2>/dev/null; then
        print_success "CPU metrics retrieved"
    else
        print_warning "No CPU metrics found"
    fi
    
    # Get request count for the last hour
    print_status "Request count for the last hour:"
    if aws cloudwatch get-metric-statistics \
        --profile $PROFILE \
        --namespace AWS/ApplicationELB \
        --metric-name RequestCount \
        --dimensions Name=LoadBalancer,Value="${PROJECT}-ui-alb" \
        --start-time $START_TIME \
        --end-time $END_TIME \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[].{Timestamp:Timestamp,Sum:Sum}' \
        --output table 2>/dev/null; then
        print_success "Request metrics retrieved"
    else
        print_warning "No request metrics found"
    fi
}

# Function to implement cost optimization
implement_cost_optimization() {
    print_status "Implementing cost optimization..."
    
    # Check if we're in the terraform directory
    if [ ! -f "terraform/stacks/prod-runtime/terragrunt.hcl" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    print_status "Current directory: $(pwd)"
    
    # Navigate to terraform directory
    cd terraform/stacks/prod-runtime
    
    print_status "Applying enhanced ECS scaling configuration..."
    
    # Apply the enhanced ECS configuration
    if terragrunt apply \
        --var="enable_scheduled_scaling=true" \
        --auto-approve; then
        print_success "Enhanced ECS scaling applied successfully"
    else
        print_error "Failed to apply ECS scaling configuration"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to show cost optimization recommendations
show_recommendations() {
    print_status "Cost optimization recommendations for 0-2 users/day:"
    echo
    echo "1. Enhanced ECS Scaling (Current Implementation):"
    echo "   - Monthly cost: ~$20-25 (40-60% reduction)"
    echo "   - Scales to 0 tasks during off-hours"
    echo "   - Maintains production reliability"
    echo
    echo "2. Lambda UI (Alternative):"
    echo "   - Monthly cost: ~$5-10"
    echo "   - Pay-per-request pricing"
    echo "   - No idle costs"
    echo
    echo "3. Lambda@Edge + CloudFront (Ultra-low-cost):"
    echo "   - Monthly cost: ~$2-5"
    echo "   - Global CDN distribution"
    echo "   - Professional performance"
    echo
    echo "Current implementation provides the best balance of cost and reliability."
}

# Function to show usage patterns
show_usage_patterns() {
    print_status "Analyzing usage patterns..."
    
    # Get request count for the last 7 days
    START_TIME=$(date -d '7 days ago' --iso-8601)
    END_TIME=$(date --iso-8601)
    
    print_status "Request patterns for the last 7 days:"
    if aws cloudwatch get-metric-statistics \
        --profile $PROFILE \
        --namespace AWS/ApplicationELB \
        --metric-name RequestCount \
        --dimensions Name=LoadBalancer,Value="${PROJECT}-ui-alb" \
        --start-time $START_TIME \
        --end-time $END_TIME \
        --period 86400 \
        --statistics Sum \
        --query 'Datapoints[].{Date:Timestamp,Requests:Sum}' \
        --output table 2>/dev/null; then
        print_success "Usage patterns retrieved"
    else
        print_warning "No usage data found for the last 7 days"
    fi
}

# Main menu
show_menu() {
    echo
    echo "=== MAIVE UI Cost Optimization Tool ==="
    echo "1. Check current costs"
    echo "2. Show ECS scaling status"
    echo "3. Show CloudWatch metrics"
    echo "4. Show usage patterns"
    echo "5. Implement cost optimization"
    echo "6. Show recommendations"
    echo "7. Run all checks"
    echo "8. Exit"
    echo
    read -p "Select an option (1-8): " choice
    
    case $choice in
        1) show_current_costs ;;
        2) show_ecs_scaling ;;
        3) show_cloudwatch_metrics ;;
        4) show_usage_patterns ;;
        5) implement_cost_optimization ;;
        6) show_recommendations ;;
        7) 
            show_current_costs
            show_ecs_scaling
            show_cloudwatch_metrics
            show_usage_patterns
            show_recommendations
            ;;
        8) 
            print_status "Exiting..."
            exit 0
            ;;
        *) 
            print_error "Invalid option. Please select 1-8."
            show_menu
            ;;
    esac
}

# Main execution
main() {
    print_status "Starting MAIVE UI Cost Optimization Tool..."
    
    # Check AWS setup
    check_aws_setup
    
    # Show menu
    show_menu
}

# Run main function
main "$@"
