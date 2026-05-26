import { type Page, type Route, expect } from '@playwright/test'

/**
 * Helpers reutilizáveis para suíte E2E do conector Web3.
 *
 * Objetivos:
 *  - Reduzir duplicação (login, seed REST, mock edge, abrir delete dialog)
 *  - Selectors resilientes via data-testid
 *  - Suporte a flows otimistas (delete c/ janela undo)
 *  - Contabilizar chamadas para o relatório
 */

export interface Web3Row {
  id: string
  provider: string
  network: string
  connection_name: string
  explorer_url: string
  api_key_hint: string | null
  last_status: string
  last_block: number | null
  last_latency_ms: number | null
  last_checked_at: string | null
  updated_at: string
}

export const UNDO_WINDOW_MS = 6_000

export function makeConnection(overrides: Partial<Web3Row> = {}): Web3Row {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    provider: 'alchemy',
    network: 'ethereum-mainnet',
    connection_name: `E2E ${Date.now()}`,
    explorer_url: 'https://etherscan.io',
    api_key_hint: 'aaaa••••zzzz',
    last_status: 'connected',
    last_block: 19_000_000,
    last_latency_ms: 120,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export function requiredDeleteToken(row: Pick<Web3Row, 'id' | 'provider' | 'connection_name'>) {
  return `${row.connection_name}#${row.provider}:${row.id.slice(0, 8)}`
}

export async function login(page: Page) {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) throw new Error('TEST_EMAIL/TEST_PASSWORD required')
  await page.goto('/auth')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Senha').fill(password)
  await page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
}

export interface MockState {
  rows: Web3Row[]
  deleteCalls: number
  deletePayloads: unknown[]
}

/**
 * Stub REST listing + edge `web3-connection-delete`.
 * `deleteHandler` recebe o id e devolve o status HTTP — permite simular
 * sucesso, falha 500, timeout, etc., sem precisar reconfigurar rotas em cada teste.
 */
export async function mockWeb3Backend(
  page: Page,
  seed: Web3Row[],
  deleteHandler: (id: string, state: MockState) => Promise<{ status: number; body: unknown }> | { status: number; body: unknown },
): Promise<MockState> {
  const state: MockState = { rows: [...seed], deleteCalls: 0, deletePayloads: [] }

  await page.route(/\/rest\/v1\/web3_connections\?.*/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.rows),
    }),
  )

  await page.route(/\/functions\/v1\/web3-connection-delete(\?.*)?$/, async (route: Route) => {
    const payload = (() => { try { return JSON.parse(route.request().postData() ?? '{}') } catch { return {} } })() as { id?: string }
    state.deleteCalls += 1
    state.deletePayloads.push(payload)
    const res = await deleteHandler(payload.id ?? '', state)
    return route.fulfill({
      status: res.status,
      contentType: 'application/json',
      body: JSON.stringify(res.body),
    })
  })

  return state
}

/** Abre o AlertDialog de delete e devolve locators acessíveis. */
export async function openDeleteDialog(page: Page) {
  const row = page.getByTestId('web3-connection-row').first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  const trigger = row.getByTestId('row-delete')
  await trigger.click()
  const dialog = page.getByTestId('web3-delete-dialog')
  await expect(dialog).toBeVisible()
  return {
    row,
    trigger,
    dialog,
    confirmBtn: page.getByTestId('web3-delete-confirm'),
    cancelBtn: page.getByTestId('web3-delete-cancel'),
    input: page.getByTestId('web3-delete-confirm-input'),
    tokenEl: page.getByTestId('web3-delete-confirm-token'),
  }
}

/** Asserções WCAG/ARIA básicas no AlertDialog. */
export async function assertDialogA11y(page: Page) {
  const ad = page.getByRole('alertdialog')
  await expect(ad).toBeVisible()
  await expect(ad).toHaveAttribute('aria-labelledby', /.+/)
  await expect(ad).toHaveAttribute('aria-describedby', /.+/)
  // Input deve receber foco inicial
  await expect(page.getByTestId('web3-delete-confirm-input')).toBeFocused()
  return {
    labelledby: await ad.getAttribute('aria-labelledby'),
    describedby: await ad.getAttribute('aria-describedby'),
  }
}

export function toasterLocator(page: Page) {
  return page.locator('[data-sonner-toaster]')
}

/** Filtro acessível para toasts (li OU role=status). */
export function toastByText(page: Page, pattern: RegExp) {
  return toasterLocator(page)
    .locator('li, [role="status"]')
    .filter({ hasText: pattern })
}

/** Snapshot textual de todos os toasts visíveis — logging determinístico. */
export async function snapshotToasts(page: Page): Promise<string[]> {
  const items = toasterLocator(page).locator('li, [role="status"]')
  const count = await items.count()
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const text = (await items.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
  }
  return out
}

/**
 * Espera determinística pelo COMMIT da deleção após a janela de undo.
 *
 * Polling de `state.deleteCalls` até atingir o valor esperado (default 1)
 * dentro de `UNDO_WINDOW_MS + buffer`. Substitui `page.waitForTimeout(...)`
 * cego: falha rápido se o commit ocorrer cedo demais ou não ocorrer.
 */
export async function waitForUndoCommit(
  _page: Page,
  state: Pick<MockState, 'deleteCalls'>,
  { expected = 1, buffer = 1_500 }: { expected?: number; buffer?: number } = {},
) {
  await expect
    .poll(() => state.deleteCalls, {
      timeout: UNDO_WINDOW_MS + buffer,
      intervals: [200, 400, 800],
      message: `Esperando deleteCalls === ${expected} dentro de UNDO_WINDOW_MS+${buffer}ms`,
    })
    .toBe(expected)
}

/**
 * Inverso de `waitForUndoCommit`: garante que NENHUMA chamada à edge
 * ocorreu durante toda a janela (ex.: cenário de undo bem-sucedido).
 * Falha imediatamente se a contagem subir.
 */
export async function expectUndoTimerCancelled(
  _page: Page,
  state: Pick<MockState, 'deleteCalls'>,
  { buffer = 1_500 }: { buffer?: number } = {},
) {
  await expect
    .poll(() => state.deleteCalls, {
      timeout: UNDO_WINDOW_MS + buffer,
      intervals: [250, 500, 1_000],
      message: 'Timer de undo deveria estar cancelado — deleteCalls não pode subir',
    })
    .toBe(0)
}
