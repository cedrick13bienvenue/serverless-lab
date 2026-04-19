variable "lambda_arns" {
  description = "Map of function key to Lambda ARN"
  type        = map(string)
}

variable "lambda_invokers" {
  description = "Map of function key to Lambda invoke ARN"
  type        = map(string)
}

variable "user_pool_arn" {
  type = string
}

variable "region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "cognito_client_id" {
  type    = string
  default = ""
}

variable "user_pool_id" {
  type    = string
  default = ""
}
