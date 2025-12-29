// Address Book example server for the single-entity form prototype
// Port: 8181
// NOTE: This is an intentionally minimal server for local development and Playwright tests.

import express from 'express';
import morgan from 'morgan';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { FormView } from '../../../src/api/FormView';

const app = express();
const PORT = 8181;

app.use(express.json());
app.use(morgan('combined'));

// --- In-memory data models ---
// Zod schemas for validation and type inference
const AddressSchema = z.object({
  id: z.string(),
  street1: z.string().min(1).describe('Street 1'),
  street2: z.string().nullable().describe('Street 2'),
  state: z.enum(['CA', 'MA', 'NY']).describe('State'),
  zipcode: z.number().int().min(10000).max(99999).describe('Zip Code'),
});

const PersonSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1).describe('Full Name'),
  phone: z.string().describe('Phone'),
  email: z.string().email().describe('Email'),
  address: AddressSchema.describe('Address'),
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1).describe('Name'),
  address: AddressSchema.describe('Address'),
  employees: z.array(PersonSchema),
  roles: z.record(z.string()),
});

// Update schemas - define which fields are editable
const UpdateAddressSchema = AddressSchema.omit({ id: true });

const UpdatePersonSchema = PersonSchema.omit({ id: true, email: true }).extend({
  address: UpdateAddressSchema,
});

const UpdateCompanySchema = CompanySchema.pick({ name: true }).extend({
  address: UpdateAddressSchema,
  employees: z.array(PersonSchema),
});

// Inferred types
type Address = z.infer<typeof AddressSchema>;
type Person = z.infer<typeof PersonSchema>;
type Company = z.infer<typeof CompanySchema>;

type UpdatePerson = z.infer<typeof UpdatePersonSchema>;
type UpdateCompany = z.infer<typeof UpdateCompanySchema>;

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

  // Validate with Zod - partial update
  const result = UpdateAddressSchema.partial().safeParse(req.body);
  if (!result.success) {
    console.error(`Invalid fields: ${JSON.stringify(result.error.errors)}`);
    return res.status(400).json({ error: 'Invalid address update', details: result.error.errors });
  }

  const updated: Address = { ...curr, ...result.data };
  addresses[updated.id] = updated;
  res.json(updated);
});

app.put('/api/address/:id', (req, res) => {
  const curr = addresses[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });

  // Validate with Zod - full update
  const result = UpdateAddressSchema.safeParse(req.body);
  if (!result.success) {
    console.error(`Invalid fields: ${JSON.stringify(result.error.errors)}`);
    return res.status(400).json({ error: 'Invalid address update', details: result.error.errors });
  }

  const updated: Address = { ...curr, ...result.data };
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

  // Validate with Zod - partial update
  const result = UpdatePersonSchema.partial().safeParse(req.body);
  if (!result.success) {
    console.error(`Invalid fields: ${JSON.stringify(result.error.errors)}`);
    return res.status(400).json({ error: 'Invalid person update', details: result.error.errors });
  }

  const updateData: Partial<UpdatePerson> = result.data;
  const updated: Person = {
    ...curr,
    ...(updateData.fullName !== undefined ? { fullName: updateData.fullName } : {}),
    ...(updateData.phone !== undefined ? { phone: updateData.phone } : {}),
    ...(updateData.address !== undefined ? { address: { ...curr.address, ...updateData.address } } : {}),
  };
  persons[updated.id] = updated;
  res.json(updated);
});

app.put('/api/person/:id', (req, res) => {
  const curr = persons[req.params.id];
  if (!curr) return res.status(404).json({ error: 'Not found' });

  // Validate with Zod - full update
  const result = UpdatePersonSchema.safeParse(req.body);
  if (!result.success) {
    console.error(`Invalid fields: ${JSON.stringify(result.error.errors)}`);
    return res.status(400).json({ error: 'Invalid person update', details: result.error.errors });
  }

  const updateData: UpdatePerson = result.data;
  const updated: Person = {
    ...curr,
    fullName: updateData.fullName,
    phone: updateData.phone,
    address: { ...curr.address, ...updateData.address },
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

  // Validate with Zod - partial update
  const result = UpdateCompanySchema.partial().safeParse(req.body);
  if (!result.success) {
    console.error(`Invalid fields: ${JSON.stringify(result.error.errors)}`);
    return res.status(400).json({ error: 'Invalid company update', details: result.error.errors });
  }

  const updateData: Partial<UpdateCompany> = result.data;
  const updated: Company = {
    ...curr,
    ...(updateData.name !== undefined ? { name: updateData.name } : {}),
    ...(updateData.address !== undefined ? { address: { ...curr.address, ...updateData.address } } : {}),
    ...(updateData.employees !== undefined ? { employees: updateData.employees } : {}),
  };
  companies[updated.id] = updated;
  res.json(updated);
});

// --- SDMUI endpoints ---
// Using JSON Schema for FormView API

function addressFormView(addr: Address): FormView<Address> {
  const jsonSchema = zodToJsonSchema(AddressSchema) as any;
  const updateSchema = zodToJsonSchema(UpdateAddressSchema) as any;

  return FormView.fromSchema(jsonSchema, 'Address')
    .forUpdateCommand(updateSchema)
    .submit({ method: 'POST', url: `/api/address/${addr.id}` })
    .buildForEntity(addr);
}

function personFormView(person: Person): FormView<Person> {
  const jsonSchema = zodToJsonSchema(PersonSchema) as any;
  const updateSchema = zodToJsonSchema(UpdatePersonSchema) as any;

  return FormView.fromSchema(jsonSchema, 'Person')
    .forUpdateCommand(updateSchema) // Email excluded, becomes read-only
    .submit({ method: 'POST', url: `/api/person/${person.id}` })
    .buildForEntity(person);
}

function companyFormView(company: Company): FormView<Company> {
  const jsonSchema = zodToJsonSchema(CompanySchema) as any;
  const updateSchema = zodToJsonSchema(UpdateCompanySchema) as any;

  return FormView.fromSchema(jsonSchema, 'Company')
    .forUpdateCommand(updateSchema)
    .submit({ method: 'POST', url: `/api/company/${company.id}` })
    .buildForEntity(company);
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

