output "tasks_table_name" {
  value = aws_dynamodb_table.tasks.name
}

output "tasks_table_arn" {
  value = aws_dynamodb_table.tasks.arn
}

output "users_table_name" {
  value = aws_dynamodb_table.users.name
}

output "users_table_arn" {
  value = aws_dynamodb_table.users.arn
}

output "tasks_stream_arn" {
  value = aws_dynamodb_table.tasks.stream_arn
}
