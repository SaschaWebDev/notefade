import { test, expect } from '@playwright/test'

test('/ shows textarea and encrypt button', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('textarea')).toBeVisible()
  await expect(page.getByRole('button', { name: 'encrypt', exact: true })).toBeVisible()
})

test('/docs shows h1 "documentation"', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.locator('h1')).toContainText('documentation')
})

test('/activate shows h2 "activate a deferred note"', async ({ page }) => {
  await page.goto('/activate')
  await expect(page.locator('h2')).toContainText('activate a deferred note')
})

test('/decode shows h2 "decode steganography"', async ({ page }) => {
  await page.goto('/decode')
  await expect(page.locator('h2')).toContainText('decode steganography')
})

test('/verify shows h2 "verify a read receipt"', async ({ page }) => {
  await page.goto('/verify')
  await expect(page.locator('h2')).toContainText('verify a read receipt')
})
