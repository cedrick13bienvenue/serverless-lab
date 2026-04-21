resource "aws_cognito_user_pool" "main" {
  name = "task-mgmt-user-pool"

  # Email as the primary identifier
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Email verification is mandatory before first login
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Task Management — verify your email"
    email_message        = "Your verification code is {####}"
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # Pre-signup Lambda blocks non-approved domains before the user is created
  lambda_config {
    pre_sign_up       = var.pre_signup_lambda_arn
    post_confirmation = var.post_confirmation_lambda_arn
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Project = "serverless-task-mgmt"
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "task-mgmt-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  read_attributes  = ["email", "email_verified", "name"]
  write_attributes = ["email", "name"]

  prevent_user_existence_errors = "ENABLED"
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# Admin group — can create, assign, close tasks
resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Users who can create and manage tasks"
}

# Member group — can view and update status of assigned tasks only
resource "aws_cognito_user_group" "members" {
  name         = "Members"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Users who can view and update their assigned tasks"
}

# Allow Cognito to call the pre-signup Lambda
resource "aws_lambda_permission" "cognito_pre_signup" {
  statement_id  = "AllowCognitoPreSignup"
  action        = "lambda:InvokeFunction"
  function_name = var.pre_signup_lambda_arn
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}

# Allow Cognito to call the post-confirmation Lambda
resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoPostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = var.post_confirmation_lambda_arn
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
