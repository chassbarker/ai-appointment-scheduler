# Selenium browser testing — local verification

**Project:** [AI Appointment Scheduler](../README.md)  
**Test script:** [test_selenium.py](../test_selenium.py)  
**Verification date:** October 24, 2026  
**Environment:** Windows, Python 3.13, Selenium 4.51.0, Microsoft Edge 155.0.4283.62  
**Target:** https://chassbarker.github.io/ai-appointment-scheduler/

## Results

The following results were reported from a local VS Code PowerShell test run:

```text
Page title: AI Appointment Scheduler
PASS: Appointment Scheduler page loaded!
PASS: Log in link is visible!
Current URL: https://chassbarker.github.io/ai-appointment-scheduler/login.html
PASS: Login navigation or password field detected!
PASS: Email and password fields are visible!
PASS: Empty login form validation blocked submission!
```

**Outcome:** 5 of 5 checks passed in the user's local browser run.

| Check | Purpose | Result |
| --- | --- | --- |
| 1 | Verify homepage title contains “scheduler” | PASS |
| 2 | Find a visible “Log in” link | PASS |
| 3 | Follow the link and verify navigation/login page | PASS |
| 4 | Verify email and password inputs are visible | PASS |
| 5 | Verify the required email and empty form fail HTML validation and remain on the login page | PASS |

## Scope and limitations

- Tests run against the deployed public site and do not need an account.
- Test 5 invokes `checkValidity()` and `requestSubmit()`. It verifies native browser constraint validation; **it does not prove that the login button can be clicked**.
- During development, physical button clicks were blocked by an `ElementClickInterceptedException` when the button fell below the visible viewport. The automation was adjusted to test form validity separately. The physical-click interaction remains unverified.
- These are local functional smoke checks. They are not a full security, accessibility, authentication, or end-to-end appointment test suite.
- These Selenium tests have not been added to the repository's GitHub Actions workflow. The existing workflow runs separate Node.js tests.
- This document records user-provided local results; it is not a CI report and does not claim the connected service independently reran them.

## Reproduce

From the repository root on a Windows machine with Microsoft Edge installed:

```powershell
python -m pip install selenium
python test_selenium.py
```

Optionally capture console output:

```powershell
python test_selenium.py > selenium_test_results.txt
```

No credentials, private API keys, or appointment data are required.
