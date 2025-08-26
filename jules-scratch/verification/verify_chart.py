from playwright.sync_api import sync_playwright, TimeoutError
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173/login")

            # Wait for the email input field to be visible
            page.wait_for_selector('input[type="email"]', timeout=10000)

            # Fill in the login form
            page.locator('input[type="email"]').fill("siscomilesinfo@gmail.com")
            page.locator('input[type="password"]').fill("qwerty")
            page.locator('button[type="submit"]').click()

            # Wait for navigation to the onboarding page
            page.wait_for_url("http://localhost:5173/onboarding", timeout=15000)

            # Step 1: Fill in First and Last Name
            page.get_by_placeholder("First Name").fill("Test")
            page.get_by_placeholder("Last Name").fill("User")
            page.get_by_role("button", name="Next").click()

            # Step 2: Fill in Professional Details
            page.wait_for_selector('input[placeholder="Current Job Title"]', timeout=10000)
            page.get_by_placeholder("Current Job Title").fill("Software Engineer")
            page.get_by_placeholder("Years of Experience").fill("5")
            page.get_by_role("button", name="Next").click()

            # Step 3: Fill in Location
            page.wait_for_selector('input[placeholder="City, State, Country"]', timeout=10000)
            page.get_by_placeholder("City, State, Country").fill("San Francisco, CA, USA")
            page.get_by_role("button", name="Next").click()

            # Step 4: Select Goals
            page.wait_for_selector('button:has-text("Find a new job")', timeout=10000)
            page.locator('button:has-text("Find a new job")').click()
            page.get_by_role("button", name="Next").click()

            # Step 5: Get Started
            page.wait_for_selector('button:has-text("Get Started")', timeout=10000)
            page.locator('button:has-text("Get Started")').click()

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
