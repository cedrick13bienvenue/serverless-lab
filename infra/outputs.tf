output "api_gateway_url" {
  description = "Base URL of the deployed API Gateway"
  value       = module.api_gateway.api_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito App Client ID (used in the frontend)"
  value       = module.cognito.user_pool_client_id
}

output "tasks_table_name" {
  description = "DynamoDB tasks table name"
  value       = module.dynamodb.tasks_table_name
}

output "users_table_name" {
  description = "DynamoDB users table name"
  value       = module.dynamodb.users_table_name
}
