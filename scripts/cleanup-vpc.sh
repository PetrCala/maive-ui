#!/bin/bash
set -euo pipefail

# ---------------- INPUTS ----------------
PROJECT_NAME="maive"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

# Function to check if required tools are available
check_prerequisites() {
  # Check AWS credentials
  if ! aws sts get-caller-identity &>/dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
  fi
  
  # Check if jq is available for JSON parsing
  if ! command -v jq &>/dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed. Using fallback method for security group processing.${NC}"
    echo -e "${YELLOW}Consider installing jq for better security group handling: brew install jq (macOS) or apt-get install jq (Ubuntu)${NC}"
  fi
}

# Function to find VPC by project tag
find_vpc() {
  local vpc_id
  vpc_id=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Project,Values=${PROJECT_NAME}" \
    --query 'Vpcs[0].VpcId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ "$vpc_id" == "None" || -z "$vpc_id" ]]; then
    echo ""
  else
    echo "$vpc_id"
  fi
}

# Function to cleanup VPC resources
cleanup_vpc_resources() {
  local vpc_id=$1
  
  if [[ -z "$vpc_id" ]]; then
    echo -e "${YELLOW}No VPC found for project ${PROJECT_NAME}${NC}"
    return 0
  fi
  
  echo -e "${BLUE}Found VPC: ${vpc_id}${NC}"
  
  # Cleanup NAT Gateways
  cleanup_nat_gateways "$vpc_id"
  
  # Cleanup Elastic IPs
  cleanup_elastic_ips "$vpc_id"
  
  # Cleanup Network ACLs
  cleanup_network_acls "$vpc_id"
  
  # Cleanup Network Interfaces (ENIs)
  cleanup_network_interfaces "$vpc_id"
  
  # Cleanup Security Groups
  cleanup_security_groups "$vpc_id"
  
  # Cleanup Route Tables
  cleanup_route_tables "$vpc_id"
  
  # Cleanup Subnets
  cleanup_subnets "$vpc_id"
  
  # Cleanup Internet Gateway
  cleanup_internet_gateway "$vpc_id"
  
  # Finally, delete the VPC
  echo -e "${YELLOW}Deleting VPC: ${vpc_id}${NC}"
  
  # Try to delete VPC with retries
  local max_retries=3
  local retry_count=0
  
  while [[ $retry_count -lt $max_retries ]]; do
    if aws ec2 delete-vpc --vpc-id "$vpc_id" --region "$AWS_REGION" >/dev/null 2>&1; then
      echo -e "${GREEN}VPC ${vpc_id} deleted successfully${NC}"
      return 0
    else
      retry_count=$((retry_count + 1))
      if [[ $retry_count -lt $max_retries ]]; then
        echo -e "${YELLOW}  VPC deletion failed, retrying in 10 seconds... (Attempt ${retry_count}/${max_retries})${NC}"
        sleep 10
        
        # Check if VPC still exists
        if ! aws ec2 describe-vpcs --vpc-ids "$vpc_id" --region "$AWS_REGION" >/dev/null 2>&1; then
          echo -e "${GREEN}VPC ${vpc_id} was deleted by another process${NC}"
          return 0
        fi
      fi
    fi
  done
  
  echo -e "${RED}Failed to delete VPC ${vpc_id} after ${max_retries} attempts${NC}"
  echo -e "${YELLOW}You may need to manually check for remaining resources${NC}"
  return 1
}

# Function to cleanup NAT Gateways
cleanup_nat_gateways() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up NAT Gateways for VPC ${vpc_id}...${NC}"
  
  local nat_gateways
  nat_gateways=$(aws ec2 describe-nat-gateways \
    --filter "Name=vpc-id,Values=${vpc_id}" \
    --query 'NatGateways[?State!="deleted"].NatGatewayId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$nat_gateways" ]]; then
    for nat_id in $nat_gateways; do
      echo "  Deleting NAT Gateway: ${nat_id}"
      aws ec2 delete-nat-gateway --nat-gateway-id "$nat_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}  Failed to delete NAT Gateway ${nat_id}${NC}"
      }
    done
    
    # Wait for NAT Gateways to be deleted
    echo "  Waiting for NAT Gateways to be deleted..."
    for nat_id in $nat_gateways; do
      aws ec2 wait nat-gateway-deleted --nat-gateway-ids "$nat_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${YELLOW}  NAT Gateway ${nat_id} still being deleted...${NC}"
      }
    done
  else
    echo "  No NAT Gateways found"
  fi
}

# Function to cleanup Elastic IPs
cleanup_elastic_ips() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Elastic IPs for VPC ${vpc_id}...${NC}"
  
  local eips
  eips=$(aws ec2 describe-addresses \
    --filters "Name=domain,Values=vpc" \
    --query 'Addresses[?AssociationId!=null].AllocationId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$eips" ]]; then
    for eip_id in $eips; do
      echo "  Releasing Elastic IP: ${eip_id}"
      aws ec2 release-address --allocation-id "$eip_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}  Failed to release Elastic IP ${eip_id}${NC}"
      }
    done
  else
    echo "  No Elastic IPs found"
  fi
}

# Function to cleanup Network ACLs
cleanup_network_acls() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Network ACLs for VPC ${vpc_id}...${NC}"
  
  local acls
  acls=$(aws ec2 describe-network-acls \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query 'NetworkAcls[?IsDefault==false].NetworkAclId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$acls" ]]; then
    for acl_id in $acls; do
      echo "  Deleting Network ACL: ${acl_id}"
      aws ec2 delete-network-acl --network-acl-id "$acl_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}  Failed to delete Network ACL ${acl_id}${NC}"
      }
    done
  else
    echo "  No custom Network ACLs found"
  fi
}

# Function to cleanup Network Interfaces
cleanup_network_interfaces() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Network Interfaces for VPC ${vpc_id}...${NC}"
  
  local enis
  enis=$(aws ec2 describe-network-interfaces \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query 'NetworkInterfaces[].NetworkInterfaceId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$enis" ]]; then
    for eni_id in $enis; do
      echo "  Deleting Network Interface: ${eni_id}"
      aws ec2 delete-network-interface --network-interface-id "$eni_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}  Failed to delete Network Interface ${eni_id}${NC}"
      }
    done
  else
    echo "  No Network Interfaces found"
  fi
}

# Function to cleanup Security Groups
cleanup_security_groups() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Security Groups for VPC ${vpc_id}...${NC}"
  
  # Get all security groups in the VPC
  local all_sgs
  all_sgs=$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query 'SecurityGroups[].{GroupId:GroupId,GroupName:GroupName,IsDefault:GroupName==`default`}' \
    --output json \
    --region "$AWS_REGION" 2>/dev/null || echo "[]")
  
  # Process each security group
  if command -v jq &>/dev/null; then
    # Use jq for proper JSON parsing
    echo "$all_sgs" | jq -r '.[] | "\(.GroupId) \(.GroupName) \(.IsDefault)"' 2>/dev/null | while read -r sg_id sg_name is_default; do
      if [[ -z "$sg_id" ]]; then
        continue
      fi
      
      if [[ "$is_default" == "true" ]]; then
        echo "  Skipping default Security Group: ${sg_id} (${sg_name})"
        echo "    Default security groups cannot be deleted and will be removed with the VPC"
        continue
      fi
    
    echo "  Processing Security Group: ${sg_id} (${sg_name})"
    
    # Check if security group is attached to any resources
    local attached_resources
    attached_resources=$(aws ec2 describe-network-interfaces \
      --filters "Name=group-id,Values=${sg_id}" \
      --query 'NetworkInterfaces[0].NetworkInterfaceId' \
      --output text \
      --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [[ "$attached_resources" != "None" && -n "$attached_resources" ]]; then
      echo "    Security Group ${sg_id} is attached to resources, skipping for now"
      continue
    fi
    
    # Check for inbound/outbound rules that reference this security group
    local inbound_rules
    inbound_rules=$(aws ec2 describe-security-groups \
      --group-ids "$sg_id" \
      --query 'SecurityGroups[0].IpPermissions[?UserIdGroupPairs[0].GroupId!=null].UserIdGroupPairs[0].GroupId' \
      --output text \
      --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [[ "$inbound_rules" != "None" && -n "$inbound_rules" ]]; then
      echo "    Security Group ${sg_id} has inbound rules, removing them first"
      aws ec2 revoke-security-group-ingress \
        --group-id "$sg_id" \
        --protocol all \
        --port -1 \
        --source-group "$sg_id" \
        --region "$AWS_REGION" >/dev/null 2>&1 || echo "    Warning: Could not remove inbound rules"
    fi
    
          # Now try to delete the security group
      echo "    Deleting Security Group: ${sg_id}"
      aws ec2 delete-security-group --group-id "$sg_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}    Failed to delete Security Group ${sg_id}${NC}"
        echo "    This security group may still be attached to resources"
      }
    done
  else
    # Fallback method without jq - just try to delete non-default security groups
    echo "  Using fallback method (jq not available)"
    local sgs
    sgs=$(aws ec2 describe-security-groups \
      --filters "Name=vpc-id,Values=${vpc_id}" \
      --query 'SecurityGroups[?GroupName!=`default`].GroupId' \
      --output text \
      --region "$AWS_REGION" 2>/dev/null || echo "")
    
    if [[ -n "$sgs" ]]; then
      for sg_id in $sgs; do
        echo "  Processing Security Group: ${sg_id}"
        echo "    Deleting Security Group: ${sg_id}"
        aws ec2 delete-security-group --group-id "$sg_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
          echo -e "${RED}    Failed to delete Security Group ${sg_id}${NC}"
        }
      done
    else
      echo "  No custom Security Groups found"
    fi
  fi
  
  echo "  Security group cleanup completed"
  }

# Function to cleanup Route Tables
cleanup_route_tables() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Route Tables for VPC ${vpc_id}...${NC}"
  
  local route_tables
  route_tables=$(aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query 'RouteTables[?Associations[0].Main!=true].RouteTableId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$route_tables" ]]; then
    for rt_id in $route_tables; do
      echo "  Processing Route Table: ${rt_id}"
      
      # First, disassociate all subnet associations
      local associations
      associations=$(aws ec2 describe-route-tables \
        --route-table-ids "$rt_id" \
        --query 'RouteTables[0].Associations[?SubnetId!=null].RouteTableAssociationId' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")
      
      if [[ -n "$associations" ]]; then
        for assoc_id in $associations; do
          echo "    Disassociating subnet association: ${assoc_id}"
          aws ec2 disassociate-route-table --association-id "$assoc_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
            echo -e "${RED}    Failed to disassociate ${assoc_id}${NC}"
          }
        done
      fi
      
      # Now delete the route table
      echo "    Deleting Route Table: ${rt_id}"
      aws ec2 delete-route-table --route-table-id "$rt_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}    Failed to delete Route Table ${rt_id}${NC}"
      }
    done
  else
    echo "  No custom Route Tables found"
  fi
}

# Function to cleanup Subnets
cleanup_subnets() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Subnets for VPC ${vpc_id}...${NC}"
  
  local subnets
  subnets=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${vpc_id}" \
    --query 'Subnets[].SubnetId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ -n "$subnets" ]]; then
    for subnet_id in $subnets; do
      echo "  Deleting Subnet: ${subnet_id}"
      aws ec2 delete-subnet --subnet-id "$subnet_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}  Failed to delete Subnet ${subnet_id}${NC}"
      }
    done
  else
    echo "  No Subnets found"
  fi
}

# Function to cleanup Internet Gateway
cleanup_internet_gateway() {
  local vpc_id=$1
  
  echo -e "${BLUE}Cleaning up Internet Gateway for VPC ${vpc_id}...${NC}"
  
  local igw_id
  igw_id=$(aws ec2 describe-internet-gateways \
    --filters "Name=attachment.vpc-id,Values=${vpc_id}" \
    --query 'InternetGateways[0].InternetGatewayId' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  
  if [[ "$igw_id" != "None" && -n "$igw_id" ]]; then
    echo "  Detaching Internet Gateway: ${igw_id}"
    aws ec2 detach-internet-gateway --internet-gateway-id "$igw_id" --vpc-id "$vpc_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
      echo -e "${RED}  Failed to detach Internet Gateway ${igw_id}${NC}"
    }
    
    echo "  Deleting Internet Gateway: ${igw_id}"
    aws ec2 delete-internet-gateway --internet-gateway-id "$igw_id" --region "$AWS_REGION" >/dev/null 2>&1 || {
      echo -e "${RED}  Failed to delete Internet Gateway ${igw_id}${NC}"
    }
  else
    echo "  No Internet Gateway found"
  fi
}

# Function to cleanup orphaned resources
cleanup_orphaned_resources() {
  echo -e "${BLUE}Cleaning up orphaned resources...${NC}"
  
  # Cleanup orphaned ECR repositories
  cleanup_ecr_repositories
  
  # Cleanup orphaned CloudWatch log groups
  cleanup_cloudwatch_logs
  
  # Cleanup orphaned IAM roles
  cleanup_iam_roles
}

# Function to cleanup ECR repositories
cleanup_ecr_repositories() {
  echo -e "${BLUE}Cleaning up ECR repositories...${NC}"
  
  local services=("react-ui" "r-plumber" "lambda-r-backend")
  
  for service in "${services[@]}"; do
    local repo_name="${PROJECT_NAME}-${service}"
    echo "  Cleaning up ECR repository: $repo_name"
    
    if aws ecr describe-repositories --repository-names "$repo_name" --region "$AWS_REGION" >/dev/null 2>&1; then
      # Delete all images first
      local images
      images=$(aws ecr list-images --repository-name "$repo_name" --region "$AWS_REGION" --query 'imageIds[*]' --output json 2>/dev/null || echo '[]')
      
      if [[ "$images" != "[]" ]]; then
        echo "    Deleting all images from $repo_name"
        aws ecr batch-delete-image \
          --repository-name "$repo_name" \
          --region "$AWS_REGION" \
          --image-ids "$images" \
          >/dev/null 2>&1 || echo "    Warning: Could not delete some images"
      fi
      
      # Delete the repository
      echo "    Deleting repository: $repo_name"
      aws ecr delete-repository --repository-name "$repo_name" --region "$AWS_REGION" >/dev/null 2>&1 || {
        echo -e "${RED}    Failed to delete repository $repo_name${NC}"
      }
    else
      echo "    Repository $repo_name does not exist"
    fi
  done
}

# Function to cleanup CloudWatch log groups
cleanup_cloudwatch_logs() {
  echo -e "${BLUE}Cleaning up CloudWatch log groups...${NC}"
  
  local log_groups=("/ecs/${PROJECT_NAME}/react-ui" "/ecs/${PROJECT_NAME}/r-plumber" "/aws/lambda/${PROJECT_NAME}-r-backend" "/aws/vpc/flowlog")
  
  for log_group in "${log_groups[@]}"; do
    echo "  Deleting log group: $log_group"
    aws logs delete-log-group --log-group-name "$log_group" --region "$AWS_REGION" >/dev/null 2>&1 || {
      echo "    Log group $log_group does not exist or could not be deleted"
    }
  done
}

# Function to cleanup IAM roles
cleanup_iam_roles() {
  echo -e "${BLUE}Cleaning up IAM roles...${NC}"
  
  local roles=("${PROJECT_NAME}-vpc-flow-log-role" "gha-terraform")
  
  for role_name in "${roles[@]}"; do
    echo "  Deleting IAM role: $role_name"
    
    # Detach policies first
    local policies
    policies=$(aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
    
    if [[ -n "$policies" ]]; then
      for policy_arn in $policies; do
        echo "    Detaching policy: $policy_arn"
        aws iam detach-role-policy --role-name "$role_name" --policy-arn "$policy_arn" >/dev/null 2>&1 || {
          echo -e "${RED}    Failed to detach policy $policy_arn${NC}"
        }
      done
    fi
    
    # Delete inline policies
    local inline_policies
    inline_policies=$(aws iam list-role-policies --role-name "$role_name" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
    
    if [[ -n "$inline_policies" ]]; then
      for policy_name in $inline_policies; do
        echo "    Deleting inline policy: $policy_name"
        aws iam delete-role-policy --role-name "$role_name" --policy-name "$policy_name" >/dev/null 2>&1 || {
          echo -e "${RED}    Failed to delete inline policy $policy_name${NC}"
        }
      done
    fi
    
    # Delete the role
    aws iam delete-role --role-name "$role_name" >/dev/null 2>&1 || {
      echo -e "${RED}    Failed to delete role $role_name${NC}"
    }
  done
}

# Main execution
main() {
  echo -e "${YELLOW}Starting VPC cleanup for project: ${PROJECT_NAME}${NC}"
  
  # Check prerequisites
  check_prerequisites
  
  # Confirm with user
  read -p "This will clean up ALL VPC resources for project ${PROJECT_NAME}. Are you sure? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Operation cancelled${NC}"
    exit 1
  fi
  
  # Find and cleanup VPC resources
  local vpc_id
  vpc_id=$(find_vpc)
  
  if [[ -n "$vpc_id" ]]; then
    cleanup_vpc_resources "$vpc_id"
  fi
  
  # Cleanup orphaned resources
  cleanup_orphaned_resources
  
  echo -e "${GREEN}VPC cleanup completed successfully!${NC}"
}

# Run main function
main "$@"
