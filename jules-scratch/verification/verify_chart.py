from playwright.sync_api import sync_playwright, TimeoutError
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("https://jobraker-six.vercel.app/SignIn")

            # Wait for the email input field to be visible
            page.wait_for_selector('input[type="email"]', timeout=10000)

            # Fill in the login form
            page.locator('input[type="email"]').fill("siscomilesinfo@gmail.com")
            page.locator('button[type="submit"]').click() # Assuming there's a continue button

            # Wait for navigation to the pricing page
            page.wait_for_url("**/pricing**", timeout=15000)

            # Select the starter plan
            page.locator('button:has-text("Get Started")').first.click()

            # Wait for navigation to the dashboard
            page.wait_for_url("**/dashboard/**", timeout=15000)

            # Take a screenshot of the dashboard
            page.screenshot(path="jules-scratch/verification/dashboard-page.png")

        except TimeoutError as e:
            print(f"Timeout error: {e}")
            page.screenshot(path="jules-scratch/verification/error-page.png")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error-page.png")
        finally:
            browser.close()

run()
