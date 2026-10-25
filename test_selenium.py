"""Browser smoke tests for the deployed AI Appointment Scheduler.

Run: python -m pip install selenium
     python test_selenium.py

Requires Microsoft Edge and an available WebDriver (Selenium Manager can install it).
No login credentials are used and no appointment records are modified.
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

driver = webdriver.Edge()
driver.maximize_window()

try:
    # Test 1: Landing page title
    driver.get("https://chassbarker.github.io/ai-appointment-scheduler/")
    print("Page title:", driver.title)
    assert "scheduler" in driver.title.lower(), "Incorrect page title"
    print("PASS: Appointment Scheduler page loaded!")

    # Test 2: Visible login link
    login_link = WebDriverWait(driver, 15).until(
        lambda d: next(
            (
                link
                for link in d.find_elements(By.TAG_NAME, "a")
                if link.text.strip().lower() == "log in"
                and link.is_displayed()
            ),
            None,
        )
    )
    assert login_link.is_displayed(), "Log in link is not visible"
    print("PASS: Log in link is visible!")

    # Test 3: Login navigation
    login_link.click()
    WebDriverWait(driver, 15).until(
        lambda d: "login" in d.current_url.lower()
        or "sign-in" in d.current_url.lower()
        or len(d.find_elements(By.CSS_SELECTOR, 'input[type="password"]')) > 0
    )
    print("Current URL:", driver.current_url)
    print("PASS: Login navigation or password field detected!")

    # Test 4: Visible email and password fields
    email_field = WebDriverWait(driver, 15).until(
        lambda d: d.find_element(By.CSS_SELECTOR, 'input[type="email"]')
    )
    password_field = driver.find_element(
        By.CSS_SELECTOR, 'input[type="password"]'
    )
    assert email_field.is_displayed(), "Email field is not visible"
    assert password_field.is_displayed(), "Password field is not visible"
    print("PASS: Email and password fields are visible!")

    # Test 5: Native HTML validation rejects an empty login form
    login_url = driver.current_url
    assert email_field.get_attribute("required") is not None, (
        "Email field should be required"
    )
    email_is_invalid = driver.execute_script(
        "return arguments[0].validity.valueMissing;", email_field
    )
    assert email_is_invalid is True, "Empty email field should fail validation"

    login_form = email_field.find_element(By.XPATH, "./ancestor::form")
    form_is_valid = driver.execute_script(
        "return arguments[0].checkValidity();", login_form
    )
    assert form_is_valid is False, "Empty login form should fail validation"

    # requestSubmit invokes browser constraint validation without needing a click.
    driver.execute_script("arguments[0].requestSubmit();", login_form)
    assert driver.current_url == login_url, (
        "Empty login form should not navigate away"
    )
    print("PASS: Empty login form validation blocked submission!")
finally:
    driver.quit()
