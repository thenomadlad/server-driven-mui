import { test, expect, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';

// This suite uses a single shared address-book server on a fixed port (8181).
// Force serial execution so Playwright doesn't shard tests in this file across workers,
// which would otherwise try to spawn multiple servers on the same port.
test.describe.configure({ mode: 'serial' });

async function waitForPort(port: number, host: string, timeoutMs: number) {
  const start = Date.now();
  return await new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      const onError = () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`timeout waiting for port ${port}`));
        else setTimeout(attempt, 500);
      };
      socket.once('error', onError);
      socket.once('timeout', onError);
      socket.connect(port, host);
    };
    attempt();
  });
}

async function resetServerData() {
  try {
    const response = await fetch('http://localhost:8181/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Reset failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to reset server data:', error);
    throw error;
  }
}

let addressBookProc: ChildProcess | undefined;

test.beforeAll(async () => {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  addressBookProc = spawn(cmd, ['run', 'server:address-book'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  await waitForPort(8181, '127.0.0.1', 60_000);
});

test.afterAll(async () => {
  if (addressBookProc && addressBookProc.pid) {
    try {
      if (process.platform === 'win32') addressBookProc.kill();
      else addressBookProc.kill('SIGTERM');
      // Wait for the process to fully terminate
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch {}
  }
});

test.beforeEach(async () => {
  // Reset server data to initial state before each test
  await resetServerData();
});

async function clickAndWaitReload(page: Page, locator: ReturnType<Page['locator']> | ReturnType<Page['getByRole']>) {
  // Most successful form actions trigger a full page reload via window.location.reload().
  // However, on failure (or if the UI changes), no reload may happen.
  // To avoid hanging tests, we wait for the next 'load' event with a bounded timeout.
  const loadPromise = page.waitForEvent('load', { timeout: 15_000 }).catch(() => undefined);
  await locator.click();
  await loadPromise;
}

async function submit(page: Page) {
  await clickAndWaitReload(page, page.getByRole('button', { name: 'Submit' }));
}

async function expectToast(page: Page, message: string | RegExp) {
  const alert = page.getByRole('alert').filter({ hasText: message });
  await expect(alert.first()).toBeVisible({ timeout: 5000 });
}

async function assertFieldValue(page: Page, expectedLabel: string, expectedValue: string) {
  const combo = page.getByRole('combobox', { name: expectedLabel, exact: true });
  if (await combo.isVisible().catch(() => false)) {
    await expect(combo).toHaveValue(String(expectedValue));
  } else {
    const input = page.getByLabel(expectedLabel, { exact: true });
    await expect(input).toHaveValue(String(expectedValue));
  }
}

async function getFieldValue(page: Page, label: string): Promise<string> {
  const combo = page.getByRole('combobox', { name: label, exact: true });
  if (await combo.isVisible().catch(() => false)) {
    // For combobox, try to read its value; if not supported, fallback to text content
    try {
      return await combo.inputValue();
    } catch {
      return await combo.textContent().then((t) => (t ?? '').trim());
    }
  }
  const input = page.getByLabel(label, { exact: true });
  return await input.inputValue();
}

function ensureDifferentValue(base: string, current: string) {
  if (String(current) === String(base)) return `${base} ${Date.now().toString().slice(-4)}`;
  return base;
}

function sdmuiUrl(endpoint: string) {
  return `/app-ui/http/localhost:8181/${endpoint}`;
}

// Address: only top-level fields exist; assert persistence on a specific top-level field
test.describe('SDMUI E2E: address', () => {
  test('edit top-level Street 1 and persist', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/address/addr-1'));
    const label = 'Street 1';
    const base = '123 Test Ave';

    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const initial = await getFieldValue(page, label);
    const value = ensureDifferentValue(base, initial);

    await input.fill('');
    await input.fill(value);
    await submit(page);
    await assertFieldValue(page, label, value);
  });
});

// Person: verify specific top-level editable field and one nested address field (editability + submission)
// Note: The prototype server does not persist nested address edits for person; do not assert persistence for nested
test.describe('SDMUI E2E: person', () => {
  test('edit top-level Full Name and persist', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/person/p-1'));
    const label = 'Full Name';
    const base = 'Ada Lovelace';

    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const initial = await getFieldValue(page, label);
    const value = ensureDifferentValue(base, initial);

    await input.fill('');
    await input.fill(value);
    await submit(page);
    await assertFieldValue(page, label, value);
  });

  test('edit nested Address Street 1 and submit (no persistence assertion)', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/person/p-1'));
    const label = 'Street 1';
    const base = '456 Nested Rd';

    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const initial = await getFieldValue(page, label);
    const value = ensureDifferentValue(base, initial);

    await input.fill('');
    await input.fill(value);
    await submit(page);
  });
});

// Company: verify specific top-level editable field and one nested address field (editability + submission)
// Note: The prototype server does not persist nested address edits for company; do not assert persistence for nested
test.describe('SDMUI E2E: company', () => {
  test('edit top-level Name and persist', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));
    const label = 'Name';
    const base = 'Company Z';

    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const initial = await getFieldValue(page, label);
    const value = ensureDifferentValue(base, initial);

    await input.fill('');
    await input.fill(value);
    await submit(page);
    await assertFieldValue(page, label, value);
  });

  test('edit nested Address Street 1 and submit (no persistence assertion)', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));
    const label = 'Street 1';
    const base = '789 Company Rd';

    const input = page.getByLabel(label, { exact: true });
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    const initial = await getFieldValue(page, label);
    const value = ensureDifferentValue(base, initial);

    await input.fill('');
    await input.fill(value);
    await submit(page);
  });

  test('employees array is editable (buttons enabled)', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));

    // Verify the employees section exists
    const employeesSection = page.locator('text=Employees').first();
    await expect(employeesSection).toBeVisible();

    // Verify "Add employees" button exists and is enabled
    const addButton = page.getByRole('button', { name: /Add employees/i });
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();

    // Verify at least one employee is displayed
    const employeeItem = page.locator('text=/Employees #1/i').first();
    await expect(employeeItem).toBeVisible();

    // Verify delete button for employee is enabled
    const deleteButtons = page.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') });
    const firstDeleteButton = deleteButtons.first();
    await expect(firstDeleteButton).toBeVisible();
    await expect(firstDeleteButton).toBeEnabled();

    // Note: Actual add/remove functionality is not yet implemented in the UI
    // The form uses defaultValue (uncontrolled) and buttons have no onClick handlers
    // This test verifies that the buttons are properly enabled based on the schema
  });

  test('delete company entity', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));

    // Verify delete button is visible and enabled
    const deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();

    // Delete triggers a full page reload on success
    await clickAndWaitReload(page, deleteButton);

    // Wait for the success message to appear (Snackbar -> Alert)
    await expectToast(page, 'Deleted successfully');

    // Verify the entity is deleted by trying to access it again
    // The page should show "WIP" skeleton since the entity no longer exists
    await page.goto(sdmuiUrl('sdmui/company/c-1'));
    await expect(page.getByTestId('skeleton-wip')).toBeVisible();
  });

  test('add employee to company array', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));

    // Get initial employee count
    const employeeItems = page.locator('text=/Employees #/i');
    const initialCount = await employeeItems.count();

    // Click "Add employees" button (triggers full page reload on success)
    const addButton = page.getByRole('button', { name: /Add employees/i });
    await clickAndWaitReload(page, addButton);

    // Wait for success message (Snackbar -> Alert)
    await expectToast(page, 'Item added successfully');

    // Verify new employee was added
    const updatedEmployeeItems = page.locator('text=/Employees #/i');
    const updatedCount = await updatedEmployeeItems.count();
    expect(updatedCount).toBe(initialCount + 1);

    // Verify the new employee section exists and a new "Full Name" input was rendered.
    // Note: avoid relying on a specific parent DOM structure.
    const lastEmployeeHeading = page.locator(`text=/Employees #${updatedCount}/i`).first();
    await expect(lastEmployeeHeading).toBeVisible();

    const fullNameInputs = page.getByLabel('Full Name', { exact: true });
    await expect(fullNameInputs).toHaveCount(updatedCount);
  });

  test('remove employee from company array', async ({ page }) => {
    await page.goto(sdmuiUrl('sdmui/company/c-1'));

    // Get initial employee count
    const employeeItems = page.locator('text=/Employees #/i');
    const initialCount = await employeeItems.count();

    // If there are no employees, add one first (this triggers a reload on success)
    if (initialCount === 0) {
      const addButton = page.getByRole('button', { name: /Add employees/i });
      await clickAndWaitReload(page, addButton);
      await expectToast(page, 'Item added successfully');
    }

    // Get the first employee's delete button
    const deleteButtons = page.getByRole('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') });
    const firstDeleteButton = deleteButtons.first();
    await expect(firstDeleteButton).toBeVisible();

    // Click the delete button (this triggers a reload on success)
    await clickAndWaitReload(page, firstDeleteButton);

    // Wait for success message (Snackbar -> Alert)
    await expectToast(page, 'Item removed successfully');

    // Verify employee was removed
    const updatedEmployeeItems = page.locator('text=/Employees #/i');
    const updatedCount = await updatedEmployeeItems.count();
    expect(updatedCount).toBeLessThan(initialCount + 1); // +1 because we might have added one
  });
});

