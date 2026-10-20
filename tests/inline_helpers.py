"""Operate the user-facing arrow-only key picker, not a hidden select."""
async def choose_key(label, tonic):
    card=label.locator('xpath=ancestor::article[1]')
    for _ in range(12):
        if await label.get_attribute('data-tonic')==tonic:
            return
        await card.locator('[data-shift="1"]').click()
    assert await label.get_attribute('data-tonic')==tonic, tonic

async def stop_card(page):
    button=page.locator('[data-play][aria-pressed="true"], [data-scale-play][aria-pressed="true"], [data-chord-play][aria-pressed="true"]')
    assert await button.count()==1
    await button.click()
