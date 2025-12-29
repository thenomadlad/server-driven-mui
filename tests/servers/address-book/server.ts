// Address Book example server for the single-entity form prototype
// Port: 8181
// NOTE: This is an intentionally minimal server for local development and Playwright tests.

import express from 'express';
import morgan from 'morgan';
import type { Request, Response } from 'express';

import { FormView } from '../../../src/api/FormView';

const app = express();
const PORT = 8181;

app.use(express.json());
app.use(morgan('combined'));

// --- In-memory data models ---
// Address
// { id: string, street1: string, street2?: string | null, state: 'CA'|'MA'|'NY', zipcode: number }
// Person
// { id: string, fullName: string, phone: string, email: string, address: Address }
// Company
// { id: string, name: string, address: Address, employees: Person[], roles: Record<string, string /* personId */> }

type Address = { id: string; street1: string; street2: string | null; state: 'CA' | 'MA' | 'NY'; zipcode: number };
type Person = { id: string; fullName: string; phone: string; email: string; address: Address };
type Company = { id: string; name: string; address: Address; employees: Person[]; roles: Record<string, string> };

let addresses: Record<string, Address> = {
  'addr-1': { id: 'addr-1', street1: '1 Main St', street2: null, state: 'CA', zipcode: 94105 },
};

let persons: Record<string, Person> = {
  'p-1': {
    id: 'p-1',
    fullName: 'Ada Lovelace',
    phone: '+1-555-0101',
    email: 'ada@example.com',
    address: { ...((({}) as any)), ...({ id: addresses['addr-1'].id, street1: addresses['addr-1'].street1, street2: addresses['addr-1'].street2, state: addresses['addr-1'].state, zipcode: addresses['addr-1'].zipcode }) },
  },
};

let companies: Record<string, Company> = {
  'c-1': {
    id: 'c-1',
    name: 'Analytical Engines Inc.',
    address: addresses['addr-1'],
    employees: [
      {
        id: persons['p-1'].id,
        fullName: persons['p-1'].fullName,
        phone: persons['p-1'].phone,
        email: persons['p-1'].email,
        address: addresses['addr-1'],
      },
    ],
    roles: { CTO: 'p-1' },
  },
};

// --- Helpers ---
const STATES = ['CA', 'MA', 'NY'];
const isZipcode = (z: number) => Number.isInteger(z) && z >= 10000 && z <= 99999;

function ensureId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- REST endpoints ---
// Address
app.get('/api/address', (_req: Request, res: Response) => {
  res.json(Object.values(addresses));
});

app.get('/api/address/:id', (req: Request, res: Response) => {
  const a = addresses[req.params.id];
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
});

app.post('/api/address', (req: Request, res: Response) => {
  const { street1, street2 = null, state, zipcode } = req.body || {};
  if (!street1 || !state || !isZipcode(zipcode) || !STATES.includes(state)) {
    return res.status(400).json({ error: 'Invalid address payload' });
  }
  const id = ensureId('addr');
  const a = { id, street1, street2, state, zipcode };
  addresses[id] = a;
  res.status(201).json(a);
});

app.post('/api/address/:id', (req, res) => {
  const curr = addresses[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const { street1, street2 = null, state, zipcode } = req.body || {};
  if (
    (street1 !== undefined && !street1) ||
    (state !== undefined && !STATES.includes(state)) ||
    (zipcode !== undefined && !isZipcode(zipcode))
  ) {
    console.error(`Invalid fields: ${JSON.stringify(req.body)}`);
    return res.status(400).json({ error: 'Invalid address update' });
  }
  const updated = { ...curr, ...req.body };
  addresses[updated.id] = updated;
  res.json(updated);
});

app.put('/api/address/:id', (req, res) => {
  const curr = addresses[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const { street1, street2 = null, state, zipcode } = req.body || {};
  if (
    (street1 !== undefined && !street1) ||
    (state !== undefined && !STATES.includes(state)) ||
    (zipcode !== undefined && !isZipcode(zipcode))
  ) {
    console.error(`Invalid fields: ${JSON.stringify(req.body)}`);
    return res.status(400).json({ error: 'Invalid address update' });
  }
  const updated = { ...curr, ...req.body };
  addresses[updated.id] = updated;
  res.json(updated);
});

app.delete('/api/address/:id', (req, res) => {
  const curr = addresses[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  delete addresses[req.params.id];
  res.status(204).send();
});

// Person
app.get('/api/person', (_req: Request, res: Response) => {
  res.json(Object.values(persons));
});

app.get('/api/person/:id', (req, res) => {
  const p = persons[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.post('/api/person', (req, res) => {
  const { fullName, phone, email, address } = req.body || {};
  if (!fullName || !phone || !email || !address) {
    return res.status(400).json({ error: 'Invalid person payload' });
  }
  const id = ensureId('p');
  const addrId = address.id && addresses[address.id] ? address.id : 'addr-1';
  const p = { id, fullName, phone, email, address: addresses[addrId] };
  persons[id] = p;
  res.status(201).json(p);
});

app.post('/api/person/:id', (req, res) => {
  const curr = persons[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const { fullName, phone, email, address } = req.body || {};
  if (email !== undefined) {
    // In prototype, email is read-only via /sdmui update mapping, but REST allows update for simplicity
  }
  const updated = {
    ...curr,
    ...(fullName !== undefined ? { fullName } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(address?.id && addresses[address.id] ? { address: addresses[address.id] } : {}),
  };
  persons[updated.id] = updated;
  res.json(updated);
});

app.put('/api/person/:id', (req, res) => {
  const curr = persons[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const { fullName, phone, email, address } = req.body || {};
  const updated = {
    ...curr,
    ...(fullName !== undefined ? { fullName } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(address?.id && addresses[address.id] ? { address: addresses[address.id] } : {}),
  };
  persons[updated.id] = updated;
  res.json(updated);
});

app.delete('/api/person/:id', (req, res) => {
  const curr = persons[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  delete persons[req.params.id];
  res.status(204).send();
});

// Company
app.get('/api/company', (req, res) => {
  res.json(Object.values(companies));
});

app.get('/api/company/:id', (req, res) => {
  const c = companies[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.post('/api/company', (req, res) => {
  const { name, address, employees = [], roles = {} } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Invalid company payload' });
  const id = ensureId('c');
  const addrId = address?.id && addresses[address.id] ? address.id : 'addr-1';
  const employeeObjs: Person[] = (Array.isArray(employees) ? employees : [])
    .map((e: any) => (e?.id && persons[e.id] ? persons[e.id] : null))
    .filter((p): p is Person => Boolean(p));
  const c = { id, name, address: addresses[addrId], employees: employeeObjs, roles };
  companies[id] = c;
  res.status(201).json(c);
});

app.post('/api/company/:id', (req, res) => {
  const curr = companies[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const { name, address, employees, roles } = req.body || {};
  const updated: Company = {
    ...curr,
    ...(name !== undefined ? { name } : {}),
    ...(address?.id && addresses[address.id] ? { address: addresses[address.id] } : {}),
    ...(Array.isArray(employees)
      ? { employees: employees.map((e: any) => (e?.id && persons[e.id] ? persons[e.id] : null)).filter((p: any): p is Person => Boolean(p)) }
      : {}),
    ...(roles && typeof roles === 'object' ? { roles } : {}),
  };
  companies[updated.id] = updated;
  res.json(updated);
});

// --- SDMUI endpoints ---
// FormView descriptor structure (simple, prototype-only)
// {
//   type: 'form',
//   title: string,
//   fields: Array<{
//     name: string,
//     label: string,
//     input: 'text' | 'number' | 'select' | 'group',
//     readOnly?: boolean,
//     options?: Array<{ label: string, value: string }>,
//     children?: same as fields,
//   }>,
//   submit: {
//     method: 'POST',
//     url: string,
//     // controls which fields are sent; frontend should only send allowed fields
//     allowFields: string[] // dot.notation for nested
//   }
// }

function addressFormView(addr: Address) {
  const fv = FormView
    .forEntity(addr)
    .title('Address')
    .fieldsAll([
      { name: 'street1', label: 'Street 1', input: 'text' },
      { name: 'street2', label: 'Street 2', input: 'text' },
      { name: 'state', label: 'State', input: 'select', options: STATES.map((s) => ({ label: s, value: s })) },
      { name: 'zipcode', label: 'Zip Code', input: 'number' },
    ])
    .submit({ method: 'POST', url: `/api/address/${addr.id}`, allowFields: [] })
    .forUpdateCommand({ street1: '', street2: '', state: 'CA', zipcode: 0 })
    .build();
  return fv.toSpec();
}

function personFormView(person: Person) {
  const fv = FormView
    .forEntity(person)
    .title('Person')
    .fieldsAll([
      { name: 'fullName', label: 'Full Name', input: 'text' },
      { name: 'phone', label: 'Phone', input: 'text' },
      { name: 'email', label: 'Email', input: 'text' },
      {
        name: 'address',
        label: 'Address',
        input: 'group',
        children: addressFormView(person.address).fields,
      },
    ])
    .submit({ method: 'POST', url: `/api/person/${person.id}`, allowFields: [] })
    // Exclude email from update command to make it read-only
    .forUpdateCommand({ fullName: '', phone: '', address: { street1: '', street2: '', state: 'CA', zipcode: 0 } })
    .build();
  return fv.toSpec();
}

function companyFormView(company: Company) {
  return {
    type: 'form',
    title: 'Company',
    fields: [
      { name: 'name', label: 'Name', input: 'text' },
      { name: 'address', label: 'Address', input: 'group', children: addressFormView(company.address).fields },
      {
        name: 'employees',
        label: 'Employees',
        input: 'group',
        // For simplicity, we won't render dynamic list editing in this prototype; just show nested person fields read-only
        children: [
          { name: '[0].fullName', label: 'First Employee Name', input: 'text', readOnly: true },
        ],
      },
    ],
    submit: {
      method: 'POST',
      url: `/api/company/${company.id}`,
      allowFields: ['name', 'address.street1', 'address.street2', 'address.state', 'address.zipcode'],
    },
    entity: company,
  };
}

app.get('/sdmui/address/:id', (req, res) => {
  const a = addresses[req.params.id];
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(addressFormView(a));
});

app.get('/sdmui/person/:id', (req, res) => {
  const p = persons[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(personFormView(p));
});

app.get('/sdmui/company/:id', (req, res) => {
  const c = companies[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(companyFormView(c));
});

app.get('/', (_req, res) => {
  res.type('text/plain').send('SDMUI example server running. Try /api/address, /api/person, /api/company, or /sdmui/...');
});

app.listen(PORT, () => {
  console.log(`Example server listening on http://localhost:${PORT}`);
});

