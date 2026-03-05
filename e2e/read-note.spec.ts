import { test, expect, type Route } from '@playwright/test'

/** Route handler for shard API — only intercepts actual API calls, not Vite module requests */
function shardHandler(capturedShardRef: { value: string | null }) {
  return (route: Route) => {
    const method = route.request().method()
    const url = new URL(route.request().url())

    // Only intercept /shard or /shard/<id> paths — not /src/api/shard-api.ts etc.
    if (!url.pathname.match(/^\/shard(\/[^/]+)?$/)) {
      return route.continue()
    }

    if (method === 'POST' && url.pathname === '/shard') {
      const body = route.request().postData()
      if (body) {
        try {
          const parsed = JSON.parse(body)
          capturedShardRef.value = parsed.shard
        } catch {
          // ignore
        }
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'aabbccdd11223344' }),
      })
    }

    if (method === 'HEAD') {
      return route.fulfill({ status: 200 })
    }

    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ shard: capturedShardRef.value }),
      })
    }

    if (method === 'DELETE') {
      return route.fulfill({ status: 204 })
    }

    return route.continue()
  }
}

test('full roundtrip: create → navigate to link → read decrypted note', async ({ page }) => {
  const capturedShard = { value: null as string | null }

  await page.route('**/*', shardHandler(capturedShard))

  // Step 1: Create a note
  await page.goto('/')
  await page.locator('textarea').fill('roundtrip secret message')
  await page.getByRole('button', { name: 'encrypt', exact: true }).click()

  // Wait for NoteLink page
  await expect(page.getByText('encrypted note ready')).toBeVisible({ timeout: 10_000 })

  // Extract the generated URL from the link text
  const linkText = await page.locator('[class*="linkText"]').textContent()
  expect(linkText).toBeTruthy()

  // Extract the fragment from the link
  const hashIndex = linkText!.indexOf('#')
  expect(hashIndex).toBeGreaterThan(-1)
  const fragment = linkText!.slice(hashIndex)

  // Step 2: Navigate to the note URL
  await page.goto('/' + fragment)

  // Should see the disclaimer / consent page
  await expect(page.getByText('someone sent you a private note')).toBeVisible({ timeout: 10_000 })

  // Check the consent checkbox
  await page.locator('input[type="checkbox"]').check()

  // Click reveal
  await page.getByRole('button', { name: /reveal note/i }).click()

  // Assert decrypted plaintext is visible
  await expect(page.getByText('roundtrip secret message')).toBeVisible({ timeout: 10_000 })
})

test('NoteGone when shard returns 404', async ({ page }) => {
  // Mock HEAD /shard/<id> to return 404
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.match(/^\/shard\/[^/]+$/) && route.request().method() === 'HEAD') {
      return route.fulfill({ status: 404 })
    }
    return route.continue()
  })

  // Navigate with a valid-looking fragment (old format: one colon, no check)
  // 16-char hex shard ID + colon + base64url payload (at least 76 bytes = 104 base64 chars)
  const fakePayload = 'A'.repeat(104)
  await page.goto(`/#deadbeef01234567:${fakePayload}`)

  await expect(page.getByText('nothing here')).toBeVisible({ timeout: 10_000 })
})

test('PasswordGate shown for protected fragment', async ({ page }) => {
  await page.goto('/#protected:somefakedata')

  await expect(page.getByText('this note is password protected')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
