"""Authenticated browser E2E test for the appointment scheduler.

Requires a dedicated, confirmed Supabase test account. Never use a real user's
account. This test writes a synthetic appointment and cancels it in cleanup.
Cancellation retains the record in history, so periodic test-data cleanup may
be needed. It does not run unless both environment variables are supplied.

PowerShell:
  $env:SCHEDULER_TEST_EMAIL = "your-test-account@example.com"
  $env:SCHEDULER_TEST_PASSWORD = "your-test-password"
  python -m pip install selenium
  python -m unittest discover -s tests -p "test_selenium_e2e.py" -v
"""
import os
import unittest
import uuid
from datetime import date, timedelta

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

BASE_URL = os.getenv(
    "SCHEDULER_BASE_URL",
    "https://chassbarker.github.io/ai-appointment-scheduler/",
).rstrip("/") + "/"


@unittest.skipUnless(
    os.getenv("SCHEDULER_TEST_EMAIL") and os.getenv("SCHEDULER_TEST_PASSWORD"),
    "Set SCHEDULER_TEST_EMAIL and SCHEDULER_TEST_PASSWORD for a dedicated test account",
)
class AppointmentWorkflow(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Edge()
        self.wait = WebDriverWait(self.driver, 20)
        self.name = "Selenium E2E " + uuid.uuid4().hex[:12]
        self.updated_name = self.name + " updated"
        self.created = False
        self.cancelled = False

    def element(self, selector):
        return self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

    def appointment_row(self, name, container="#upcomingAppointmentsList"):
        return self.wait.until(
            lambda d: next(
                (row for row in d.find_elements(By.CSS_SELECTOR, container + " article.appointment-item")
                 if row.find_element(By.CSS_SELECTOR, "h4").text == name),
                None,
            )
        )

    def login(self):
        self.driver.get(BASE_URL + "login.html")
        self.element("#email").send_keys(os.environ["SCHEDULER_TEST_EMAIL"])
        self.element("#password").send_keys(os.environ["SCHEDULER_TEST_PASSWORD"])
        self.driver.find_element(By.CSS_SELECTOR, '#loginForm button[type="submit"]').click()
        self.wait.until(EC.url_contains("dashboard.html"))
        self.element("#welcomeMessage")
        self.wait.until(lambda d: "Loading appointments..." not in d.find_element(
            By.ID, "upcomingAppointmentsList").text)

    def open_form(self):
        self.element("#openManualFormBtn").click()
        self.wait.until(lambda d: d.find_element(By.ID, "manualAppointmentSection").get_attribute("open") is not None)

    def fill_form(self, name):
        self.element("#name").clear()
        self.driver.find_element(By.ID, "name").send_keys(name)
        Select(self.driver.find_element(By.ID, "type")).select_by_value("Personal")
        self.wait.until(lambda d: len([o for o in Select(d.find_element(By.ID, "provider")).options if o.get_attribute("value")]) > 0)
        provider = Select(self.driver.find_element(By.ID, "provider"))
        provider.select_by_index(next(i for i, o in enumerate(provider.options) if o.get_attribute("value")))
        # Try future weekdays, respecting the app's 90-day window. Provider
        # availability may vary; a rejected booking fails clearly.
        target = date.today() + timedelta(days=14)
        while target.weekday() >= 5:
            target += timedelta(days=1)
        self.driver.find_element(By.ID, "date").send_keys(target.isoformat())
        Select(self.driver.find_element(By.ID, "timeHour")).select_by_value("10")
        Select(self.driver.find_element(By.ID, "timeMinute")).select_by_value("00")
        Select(self.driver.find_element(By.ID, "timePeriod")).select_by_value("AM")

    def save(self, expected_message):
        self.driver.find_element(By.ID, "saveAppointmentBtn").click()
        self.wait.until(lambda d: expected_message in d.find_element(By.ID, "appointmentMessage").text
                        or "Unable to save appointment" in d.find_element(By.ID, "appointmentMessage").text)
        message = self.driver.find_element(By.ID, "appointmentMessage").text
        self.assertIn(expected_message, message, message)

    def cancel_named(self, name):
        row = self.appointment_row(name)
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", row)
        row.find_element(By.XPATH, ".//button[normalize-space()='Cancel']").click()
        self.wait.until(EC.alert_is_present()).accept()
        self.wait.until(lambda d: "Appointment cancelled." in d.find_element(By.ID, "appointmentMessage").text)
        self.cancelled = True
        self.wait.until(lambda d: not any(
            r.find_element(By.CSS_SELECTOR, "h4").text == name
            for r in d.find_elements(By.CSS_SELECTOR, "#upcomingAppointmentsList article.appointment-item")
        ))
        self.appointment_row(name, "#pastAppointmentsList")

    def test_create_edit_cancel(self):
        self.login()
        self.open_form()
        self.fill_form(self.name)
        self.save("Appointment saved.")
        self.created = True
        row = self.appointment_row(self.name)
        row.find_element(By.XPATH, ".//button[normalize-space()='Edit']").click()
        self.wait.until(lambda d: d.find_element(By.ID, "appointmentId").get_attribute("value"))
        self.element("#name").clear()
        self.driver.find_element(By.ID, "name").send_keys(self.updated_name)
        self.save("Appointment updated.")
        self.appointment_row(self.updated_name)
        self.cancel_named(self.updated_name)

    def tearDown(self):
        try:
            if self.created and not self.cancelled:
                # Best-effort cleanup via the UI. Never cancel unrelated records.
                for name in (self.updated_name, self.name):
                    try:
                        self.cancel_named(name)
                        break
                    except Exception:
                        continue
                if not self.cancelled:
                    print("WARNING: Test appointment may remain scheduled:", self.name)
        finally:
            self.driver.quit()


if __name__ == "__main__":
    unittest.main()
