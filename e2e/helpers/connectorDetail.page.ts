import { Page, Locator, expect } from '@playwright/test'
import {
  DF_TIMEOUT,
  expectActionable,
  pushRunParam,
  waitForConnectorEvent,
  waitForDialogState,
  waitForSearchParam,
} from './waits'

/**
 * Page Object for the ConnectorDetailPage. Centralizes selectors and
 * deterministic interactions so individual specs stay declarative.
 */
export class ConnectorDetailPage {
  readonly page: Page
  readonly slug: string

  constructor(page: Page, slug = 'github') {
    this.page = page
    this.slug = slug
  }

  // ----- selectors -----
  get resetTrigger(): Locator { return this.page.getByTestId('reset-filters-trigger') }
  get resetDialog(): Locator { return this.page.getByTestId('reset-filters-dialog') }
  get resetCancel(): Locator { return this.page.getByTestId('reset-filters-cancel') }
  get resetConfirm(): Locator { return this.page.getByTestId('reset-filters-confirm') }

  get banner(): Locator { return this.page.getByTestId('undo-banner') }
  get counter(): Locator { return this.page.getByTestId('undo-counter') }
  get renew(): Locator { return this.page.getByTestId('undo-renew-button') }
  get dismiss(): Locator { return this.page.getByTestId('undo-dismiss-button') }

  get dismissDialog(): Locator { return this.page.getByTestId('undo-dismiss-confirm') }
  get dismissCancel(): Locator { return this.page.getByTestId('undo-dismiss-cancel') }
  get dismissConfirmBtn(): Locator { return this.page.getByTestId('undo-dismiss-confirm-button') }

  // ----- navigation -----
  async login(email: string, password: string) {
    await this.page.context().clearCookies()
    await this.page.goto('/auth')
    await this.page.getByPlaceholder('Email').fill(email)
    await this.page.getByPlaceholder('Senha').fill(password)
    await this.page.getByRole('button', { name: /entrar|login|sign in/i }).first().click()
    await this.page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 })
  }

  async openWithRun(sha: string) {
    await this.page.goto(`/connectors/${this.slug}?run=${sha}`)
    await this.page.waitForURL(`**/connectors/${this.slug}**`, { timeout: 15_000 })
    await waitForSearchParam(this.page, 'run', sha)
  }

  async ensureRunParam(sha: string) {
    await pushRunParam(this.page, sha)
  }

  // ----- flows -----
  async triggerUndoBanner() {
    await expectActionable(this.resetTrigger, 'reset trigger')
    await this.resetTrigger.click()
    await waitForDialogState(this.resetDialog, 'open')
    await this.resetConfirm.click()
    await waitForDialogState(this.resetDialog, 'closed')
    await expect(this.banner).toBeVisible({ timeout: 10_000 })
  }

  async openResetCycle(sha: string) {
    await this.ensureRunParam(sha)
    await expectActionable(this.resetTrigger, 'reset trigger (cycle)')
    await this.resetTrigger.click()
    await waitForDialogState(this.resetDialog, 'open')
  }

  async cancelResetCycle() {
    await this.resetCancel.click()
    await waitForDialogState(this.resetDialog, 'closed')
  }

  // ----- shortcut helpers -----
  /** Power-user shortcut: dismiss banner immediately, no modal. */
  async pressShiftEsc() {
    await this.page.keyboard.press('Shift+Escape')
  }
  async pressEsc() {
    await this.page.keyboard.press('Escape')
  }
  async pressUndo() {
    // Cmd on macOS, Ctrl elsewhere — both supported by the handler.
    await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  }

  // ----- analytics asserts -----
  waitForEvent(eventType: string, timeout = DF_TIMEOUT) {
    return waitForConnectorEvent(this.page, eventType, timeout)
  }
}
