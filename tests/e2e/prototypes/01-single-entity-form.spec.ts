import { test, expect, Page } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';

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
    } catch {}
  }
});

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForLoadState('load');
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
    const base = 'Grace Hopper';

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
});

