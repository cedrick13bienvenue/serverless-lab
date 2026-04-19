output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "admins_group_name" {
  value = aws_cognito_user_group.admins.name
}

output "members_group_name" {
  value = aws_cognito_user_group.members.name
}
