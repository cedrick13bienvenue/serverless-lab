variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "ses_from_email" {
  description = "Verified SES email address used as the sender"
  type        = string
}
