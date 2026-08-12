output "lambda_function_name" {
  description = "Name of the scheduling assistant Lambda function"
  value       = aws_lambda_function.scheduling_assistant.function_name
}

output "lambda_role_arn" {
  description = "ARN of the scheduling assistant Lambda execution role"
  value       = aws_iam_role.scheduling_assistant.arn
}

output "scheduling_api_endpoint" {
  description = "URL for submitting scheduling requests"
  value       = "${aws_apigatewayv2_api.scheduling_assistant.api_endpoint}/schedule"
}
