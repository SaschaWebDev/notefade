import { test, expect } from '@playwright/test'

test('create note flow produces an encrypted note link', async ({ page }) => {
  // Mock POST /shard to return a fake shard ID
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/shard' && route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'deadbeef01234567' }),
      })
    }
    return route.continue()
  })

  await page.goto('/')

  // Fill the textarea with a test message
  await page.locator('textarea').fill('my secret test note')

  // Click encrypt
  await page.getByRole('button', { name: 'encrypt', exact: true }).click()

  // NoteLink page should appear with "encrypted note ready" text
  await expect(page.getByText('encrypted note ready')).toBeVisible({ timeout: 10_000 })

  // The link text should contain the fragment with the shard ID
  const linkText = await page.locator('[class*="linkText"]').textContent()
  expect(linkText).toBeTruthy()
  expect(linkText).toContain('#')
  expect(linkText).toContain('deadbeef01234567')
})
