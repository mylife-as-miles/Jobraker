from playwright.sync_api import sync_playwright, TimeoutError
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # --- Registration ---
            page.goto("http://localhost:5174/login", wait_until="domcontentloaded")

            # Click on the "Sign up" link
            page.get_by_role("link", name="Sign up").click()

            # Wait for the email input field to be visible
            page.wait_for_selector('input[type="email"]', timeout=10000)

            # Fill in the registration form
            timestamp = int(time.time())
            email = f"testuser{timestamp}@example.com"
            password = "password123"
            page.locator('input[type="email"]').fill(email)
            page.locator('input[type="password"]').fill(password)
            page.locator('button[type="submit"]').click()

            # --- Email Verification ---
            page.goto("http://localhost:54324")
            page.wait_for_selector(f'td:has-text("{email}")')
            page.locator(f'td:has-text("{email}")').first.click()
            page.frame_locator("iframe").locator('a:has-text("Confirm your mail")').click()

            # --- Login ---
            page.goto("http://localhost:5174/login", wait_until="domcontentloaded")

            # Fill in the login form
            page.wait_for_selector('input[type="email"]', timeout=10000)
            page.locator('input[type="email"]').fill(email)
            page.locator('input[type="password"]').fill(password)
            page.locator('button[type="submit"]').click()

            # Wait for navigation to the dashboard
            page.wait_for_url("**/dashboard/**", timeout=15000)

            # Take a screenshot of the dashboard
            page.screenshot(path="jules-scratch/verification/dashboard-page.png")
            print("Successfully took screenshot of dashboard page.")

        except TimeoutError as e:
            print(f"Timeout error: {e}")
            page.screenshot(path="jules-scratch/verification/error-page.png")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error-page.png")
        finally:
            browser.close()

run()
