# Optional AI-assisted Selenium failure analysis

This experiment uses **Amazon Bedrock** to suggest troubleshooting steps for a **manually sanitized** Selenium test failure. It does not change your appointment app, run Selenium, or determine test pass/fail. Existing Selenium assertions remain authoritative.

## Before you start

1. In your personal AWS account, create a monthly AWS Budget notification (for example, $5). **Alerts do not cap charges.**
2. Check Amazon Bedrock model access, current pricing, and model availability in **us-east-1**. The script defaults to `amazon.nova-micro-v1:0`; use `--model-id` if your account requires another supported model.
3. Use an AWS identity with only the necessary Bedrock model-invocation permission. Configure credentials locally through AWS CLI or an AWS profile; **never commit credentials**.
4. Install `boto3`: `python -m pip install boto3`.

## Try a synthetic failure first

Copy `docs/sample-selenium-failure.json` to a local file and review every field. Use invented, non-sensitive text only. Do **not** paste raw browser logs, screenshots, page source, account emails, cookies, URLs with query parameters, tokens, patient data, or appointment notes.

Run in PowerShell:

```powershell
python tools/bedrock_failure_analyzer.py docs/sample-selenium-failure.json
# The command above refuses to call AWS without explicit approval.
python tools/bedrock_failure_analyzer.py docs/sample-selenium-failure.json --send
```

The second command makes **one billable Bedrock request**. The script sends only the allowlisted fields: `test_name`, `exception_type`, `failure_summary`, `expected`, and `actual`. Each field is capped at 500 characters. A basic pattern check rejects some obvious secrets, but it cannot guarantee redaction. **Manually review the JSON before every request.**

If you get an AccessDeniedException or model-not-supported error, verify the model ID, regional access, and IAM policy before retrying. Avoid repeated calls while troubleshooting cost or permissions.

## Limitations

- This is a **manual proof of concept**, not automatic failure capture or CI integration.
- AI output is only suggested debugging guidance and may be incorrect.
- AWS charges depend on model and tokens; no fixed per-run price is guaranteed.
- No AWS resources, budgets, IAM policies, or model access are provisioned by this pull request.
