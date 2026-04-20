variable "pre_signup_lambda_arn" {
  description = "ARN of the pre-signup Lambda trigger"
  type        = string
}

variable "post_confirmation_lambda_arn" {
  description = "ARN of the post-confirmation Lambda trigger"
  type        = string
}

variable "ses_from_email" {
  description = "Verified SES sender email"
  type        = string
}
