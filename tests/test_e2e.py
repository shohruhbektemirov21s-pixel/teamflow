from playwright.sync_api import sync_playwright
import time

def test_app():
    with sync_playwright() as p:
        # Launch browser in headed mode so it's visible to the user
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()
        
        # Go to the frontend app
        print("Saytga o'tilmoqda...")
        page.goto("http://localhost:5173/", wait_until="networkidle")
        
        # Wait a bit for the user to see the page
        time.sleep(2)
        
        # Let's see if we can do something
        # For example, check the title or click something
        try:
            # Look for a login button or something
            page.screenshot(path="tests/screenshot_1.png")
            print("Skrinshot olindi.")
            
            # Simple interaction if there's an input or button
            # We don't know the exact UI, so we just wait and scroll
            page.evaluate("window.scrollBy(0, 500)")
            time.sleep(2)
            page.evaluate("window.scrollBy(0, -500)")
            
            # Let's take another screenshot
            page.screenshot(path="tests/screenshot_2.png")
            
            print("Test yakunlandi.")
            time.sleep(2)
        except Exception as e:
            print("Xatolik:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    test_app()
