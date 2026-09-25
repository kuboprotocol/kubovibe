import type { Page } from '@playwright/test'

/**
 * Login de E2E para páginas protegidas (ProtectedRoute).
 *
 * Mesma convenção dos specs de conectores: usa a conta de teste das
 * variáveis TEST_EMAIL / TEST_PASSWORD (secrets do repositório no CI). Sem
 * elas, os specs que dependem de login são pulados com o motivo explícito,
 * em vez de falharem na tela de login.
 */
export const TEST_EMAIL = process.env.TEST_EMAIL
export const TEST_PASSWORD = process.env.TEST_PASSWORD
export const HAS_TEST_CREDENTIALS = Boolean(TEST_EMAIL && TEST_PASSWORD)
export const NEEDS_LOGIN_REASON =
  'Página protegida por login: defina TEST_EMAIL e TEST_PASSWORD (secrets do repositório)'
export const NEEDS_ADMIN_REASON =
  'Página restrita a admin: defina TEST_EMAIL e TEST_PASSWORD de uma conta com papel admin'

export async function login(page: Page) {
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(TEST_EMAIL!)
  await page.getByPlaceholder('Senha').fill(TEST_PASSWORD!)
  await page.getByTestId('auth-submit').click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}
