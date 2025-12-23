from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        # Navigate to the landing page
        page.goto("http://localhost:3000")

        # Wait a bit for the 3D canvas and texture to load
        time.sleep(5)

        # Take a screenshot of the top hero area where the orb is
        page.screenshot(path="verification_earth_map.png", full_page=False)

        browser.close()

if __name__ == "__main__":
    run()
