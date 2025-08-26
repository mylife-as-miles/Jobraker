from playwright.sync_api import sync_playwright, TimeoutError
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173/auth/login")

            # Click on the "Sign up" link
            page.locator('a[href="/auth/register"]').click()

            # Wait for the name input field to be visible
            page.wait_for_selector('input[name="name"]', timeout=10000)

            # Fill in the registration form
            page.locator('input[name="name"]').fill("Test User")
            page.locator('input[name="email"]').fill("test@example.com")
            page.locator('input[name="password"]').fill("password123")
            page.locator('button[type="submit"]').click()

            # Wait for navigation to the dashboard
            time.sleep(5)

            # Take a screenshot of the dashboard
            page.screenshot(path="jules-scratch/verification/dashboard-page.png")

        except TimeoutError:
            print("Timeout while waiting for registration form to load.")
            page.screenshot(path="jules-scratch/verification/error-page.png")
        finally:
            browser.close()

run()
