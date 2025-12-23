
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-setuid-sandbox"])
        page = await browser.new_page()

        # Ensure directory exists
        os.makedirs("verification", exist_ok=True)

        print("Navigating to Landing Page...")
        # Assuming the dev server is running on port 3000 (standard for Vite)
        # If not running, I would need to start it, but usually the environment has it or I can just assume static analysis if server isn't up.
        # But for screenshots I need it running.
        # In this environment, I should probably start the server if it's not running.
        # But I don't want to block.
        # I'll try to hit localhost:3000.

        try:
            await page.goto("http://localhost:3000/", timeout=60000)
            await page.wait_for_load_state("networkidle")

            # Scroll to expose sections
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(2000)
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(1000)

            # Screenshot Bento Grid
            bento = page.locator("section:has-text('Everything you need to dominate')")
            if await bento.count() > 0:
                await bento.screenshot(path="verification/final_bento.png")
                print("Bento grid screenshot saved.")

            # Screenshot Integrations
            integrations = page.locator("section:has-text('CONNECTED ECOSYSTEM')")
            if await integrations.count() > 0:
                await integrations.screenshot(path="verification/final_integrations.png")
                print("Integrations screenshot saved.")

        except Exception as e:
            print(f"Error during verification: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
