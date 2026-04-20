resource "aws_apigatewayv2_api" "main" {
  name          = "task-mgmt-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Content-Type", "Authorization"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 300
  }

  tags = {
    Project = "serverless-task-mgmt"
  }
}

# JWT authorizer backed by Cognito — every route requires a valid access token
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${var.user_pool_id}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format          = "$context.requestId $context.status $context.routeKey $context.error.message"
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/api-gateway/task-mgmt-api"
  retention_in_days = 14
}

locals {
  routes = {
    "GET /users"              = "get_users"
    "POST /tasks"             = "create_task"
    "GET /tasks"              = "get_tasks"
    "GET /tasks/{taskId}"     = "get_task"
    "PUT /tasks/{taskId}"     = "update_task"
    "PATCH /tasks/{taskId}/assign" = "assign_task"
    "DELETE /tasks/{taskId}"  = "delete_task"
  }
}

resource "aws_apigatewayv2_integration" "lambdas" {
  for_each = local.routes

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_invokers[each.value]
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = each.key
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.lambdas[each.key].id}"
}

# Grant API Gateway permission to invoke each Lambda
resource "aws_lambda_permission" "api_gw" {
  for_each = local.routes

  statement_id  = "AllowAPIGatewayInvoke-${replace(each.key, "/[^a-zA-Z0-9_-]/", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_arns[each.value]
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
