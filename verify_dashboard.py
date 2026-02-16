from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to Dashboard Overview...")
        page.goto("http://localhost:3000/dashboard/overview")

        print(f"Page Title: {page.title()}")

        if "JobRaker" in page.title() and "Autonomous" in page.title():
             print("Redirected to Landing Page.")
        else:
             print("Reached Dashboard (presumably).")
             page.screenshot(path="debug_dashboard.png")

        browser.close()

if __name__ == "__main__":
    run()
