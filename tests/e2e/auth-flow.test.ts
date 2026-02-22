import { test, expect } from '@playwright/test'

test('auth flow smoke: signin route is reachable', async ({ page }) => {
  await page.goto('/auth/signin')
  await expect(page).toHaveURL(/\/auth\/signin/)
})
