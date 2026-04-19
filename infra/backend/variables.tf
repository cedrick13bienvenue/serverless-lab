variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "bucket_name" {
  description = "S3 bucket name for Terraform remote state"
  type        = string
  default     = "serverless-task-mgmt-tf-state"
}

variable "lock_table_name" {
  description = "DynamoDB table name for state locking"
  type        = string
  default     = "serverless-task-mgmt-tf-lock"
}
