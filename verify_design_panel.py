from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            # Navigate to Resume Builder
            print("Navigating to Resume Builder...")
            page.goto("http://localhost:3000/dashboard/resume/edit/new")

            # Wait for page to load - check for "Content" tab to ensure we are on the builder
            print("Waiting for Content tab...")
            # Take screenshot before waiting
            page.screenshot(path="debug_before_wait.png")

            expect(page.get_by_role("button", name="Content")).to_be_visible(timeout=5000)

            # Click "Design" main tab
            print("Clicking Design tab...")
            page.get_by_role("button", name="Design").click()

            # Wait for Design Panel to load - check for "Typography" sub-tab
            print("Waiting for Typography sub-tab...")
            expect(page.get_by_role("button", name="Typography")).to_be_visible()

            # Verify Page tab works
            print("Clicking Page sub-tab...")
            page.get_by_role("button", name="Page").click()
            expect(page.get_by_text("Format")).to_be_visible()
            expect(page.get_by_text("Margins")).to_be_visible()

            # Verify Layout tab works
            print("Clicking Layout sub-tab...")
            page.get_by_role("button", name="Layout").click()
            expect(page.get_by_text("Sidebar Width")).to_be_visible()

            # Verify Design sub-tab works (colors)
            print("Clicking Design sub-tab...")
            design_buttons = page.get_by_role("button", name="Design").all()
            if len(design_buttons) > 1:
                print(f"Found {len(design_buttons)} Design buttons. Clicking the second one.")
                design_buttons[1].click()
            else:
                print("Only 1 Design button found. This might be wrong if panel loaded.")
                design_buttons[0].click()

            # Check for "Primary Color" label
            expect(page.get_by_text("Primary Color")).to_be_visible()

            # Take Screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification_design_panel.png")
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="debug_error.png")
            print("Debug screenshot saved to debug_error.png")
            # Print page title and content
            print(f"Page Title: {page.title()}")
            # print(f"Page Content: {page.content()}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
