output "pre_signup_lambda_arn" {
  value = aws_lambda_function.functions["pre_signup"].arn
}

output "post_confirmation_lambda_arn" {
  value = aws_lambda_function.functions["post_confirmation"].arn
}

output "function_arns" {
  value = { for k, v in aws_lambda_function.functions : k => v.arn }
}

output "function_invoke_arns" {
  value = { for k, v in aws_lambda_function.functions : k => v.invoke_arn }
}
