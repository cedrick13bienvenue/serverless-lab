terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "serverless-task-mgmt-tf-state"
    key            = "serverless-task-mgmt/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "serverless-task-mgmt-tf-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

module "dynamodb" {
  source = "./modules/dynamodb"
}

module "cognito" {
  source                = "./modules/cognito"
  pre_signup_lambda_arn        = module.lambda.pre_signup_lambda_arn
  post_confirmation_lambda_arn = module.lambda.post_confirmation_lambda_arn
  ses_from_email        = var.ses_from_email
}

module "ses" {
  source     = "./modules/ses"
  from_email = var.ses_from_email
}

module "lambda" {
  source             = "./modules/lambda"
  tasks_table_name   = module.dynamodb.tasks_table_name
  tasks_table_arn    = module.dynamodb.tasks_table_arn
  users_table_name   = module.dynamodb.users_table_name
  users_table_arn    = module.dynamodb.users_table_arn
  ses_from_email     = var.ses_from_email
  region             = var.region
  account_id         = data.aws_caller_identity.current.account_id
}

module "api_gateway" {
  source            = "./modules/api-gateway"
  lambda_arns       = module.lambda.function_arns
  lambda_invokers   = module.lambda.function_invoke_arns
  user_pool_arn     = module.cognito.user_pool_arn
  user_pool_id      = module.cognito.user_pool_id
  cognito_client_id = module.cognito.user_pool_client_id
  region            = var.region
  account_id        = data.aws_caller_identity.current.account_id
}

data "aws_caller_identity" "current" {}
