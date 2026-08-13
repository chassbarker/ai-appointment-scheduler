locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  function_name   = "${local.resource_prefix}-scheduling-assistant"
}

data "archive_file" "scheduling_assistant" {
  type        = "zip"
  source_dir  = "${path.module}/../../aws/lambda/scheduling-assistant"
  output_path = "${path.module}/scheduling-assistant.zip"

  excludes = [
    "index.test.mjs",
  ]
}

resource "aws_iam_role" "scheduling_assistant" {
  name = "${local.resource_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logging" {
  role       = aws_iam_role.scheduling_assistant.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "scheduling_assistant" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "scheduling_assistant" {
  function_name = local.function_name
  role          = aws_iam_role.scheduling_assistant.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  filename         = data.archive_file.scheduling_assistant.output_path
  source_code_hash = data.archive_file.scheduling_assistant.output_base64sha256

  memory_size = 128
  timeout     = 10


  depends_on = [
    aws_iam_role_policy_attachment.lambda_logging,
    aws_cloudwatch_log_group.scheduling_assistant,
  ]
}

resource "aws_apigatewayv2_api" "scheduling_assistant" {
  name          = "${local.resource_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["POST", "OPTIONS"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "scheduling_assistant" {
  api_id                 = aws_apigatewayv2_api.scheduling_assistant.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.scheduling_assistant.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "scheduling_assistant" {
  api_id    = aws_apigatewayv2_api.scheduling_assistant.id
  route_key = "POST /schedule"
  target    = "integrations/${aws_apigatewayv2_integration.scheduling_assistant.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.scheduling_assistant.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduling_assistant.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.scheduling_assistant.execution_arn}/*/*"
}
