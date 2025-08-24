from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")

    # Wait for the StepGuide component to be visible
    step_guide_card = page.locator('div.w-full.max-w-4xl.mx-auto:has-text("How to Create Your Solana Token")')
    expect(step_guide_card).to_be_visible(timeout=15000)

    # Now, let's take a screenshot of the whole page.
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
