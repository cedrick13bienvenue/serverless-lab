locals {
  functions = {
    pre_signup       = { handler = "auth/preSignup.handler",       description = "Blocks non-approved email domains at signup" }
    post_confirmation = { handler = "auth/postConfirmation.handler", description = "Syncs verified user into users table" }
    create_task      = { handler = "tasks/createTask.handler",      description = "Admin: create a new task" }
    get_tasks        = { handler = "tasks/getTasks.handler",         description = "Admin: all tasks; Member: assigned tasks" }
    get_task         = { handler = "tasks/getTask.handler",          description = "Get single task by ID" }
    update_task      = { handler = "tasks/updateTask.handler",       description = "Admin: full update; Member: status only" }
    assign_task      = { handler = "tasks/assignTask.handler",       description = "Admin: assign task to members" }
    delete_task      = { handler = "tasks/deleteTask.handler",       description = "Admin: close/delete a task" }
    notify           = { handler = "notifications/notify.handler",   description = "Send SES emails on assignment/status change" }
    get_users        = { handler = "users/getUsers.handler",          description = "Admin: list all users" }
  }

  common_env = {
    TASKS_TABLE = var.tasks_table_name
    USERS_TABLE = var.users_table_name
    SES_FROM    = var.ses_from_email
    REGION      = var.region
  }
}

# Single IAM role shared by all Lambda functions (least-privilege policy below)
resource "aws_iam_role" "lambda_exec" {
  name = "serverless-task-mgmt-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Project = "serverless-task-mgmt"
  }
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "serverless-task-mgmt-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
        ]
        Resource = [
          var.tasks_table_arn,
          "${var.tasks_table_arn}/index/*",
          var.users_table_arn,
          "${var.users_table_arn}/index/*",
        ]
      },
      {
        Sid      = "SESSendEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Sid    = "CognitoReadGroups"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:ListUsersInGroup",
        ]
        Resource = "arn:aws:cognito-idp:${var.region}:${var.account_id}:userpool/*"
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${var.region}:${var.account_id}:*"
      },
    ]
  })
}

# Zip the compiled Lambda dist — built by `npm run build` in /backend
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.root}/../backend/dist"
  output_path = "${path.root}/../backend/lambda.zip"
}

resource "aws_lambda_function" "functions" {
  for_each = local.functions

  function_name = "task-mgmt-${replace(each.key, "_", "-")}"
  role          = aws_iam_role.lambda_exec.arn
  handler       = each.value.handler
  runtime       = "nodejs20.x"
  filename      = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout       = 30
  memory_size   = 256
  description   = each.value.description

  environment {
    variables = local.common_env
  }

  tags = {
    Project = "serverless-task-mgmt"
  }
}
