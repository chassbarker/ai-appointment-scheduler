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

  memory_size                    = 128
  timeout                        = 10
  reserved_concurrent_executions = 2

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logging,
    aws_cloudwatch_log_group.scheduling_assistant,
  ]
}
