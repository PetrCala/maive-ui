# Cost Explorer, including its Cost Anomaly Detection resources, is a global
# service reachable only through us-east-1. Terragrunt generates the default
# provider (region = var.region) in provider.tf; this adds an aliased us-east-1
# provider used by the anomaly-detection resources in cost_anomaly.tf.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
