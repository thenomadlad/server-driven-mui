import { type FormViewSpec } from '@/api/FormView';
import { FormViewServerRenderer } from '@/theme/simple';
import FormShell, { type SubmitResult } from '@/components/FormShell';
import { type JSONSchemaType } from 'ajv';
import { JSONPath } from 'jsonpath-plus';

// Server-side SDMUI route
// - Builds the target backend URL from route params
// - Fetches a FormViewSpec from the backend
// - Renders a fully server-side form that submits to a Next.js Server Action
// - The server action filters fields per allowFields and forwards JSON to the backend submit URL


function getParentOfTargetPath(json: any, path: string) {
  // Find the parent object
  const parents = JSONPath({
    path,
    json,
    resultType: 'parent' // gets you parent references
  });

  return parents.length > 0
    ? parents[0]
    : json;  // by default if no parent is found
}

type AnyJsonSchema = any;

function resolveJsonPointer(root: AnyJsonSchema, pointer: string): AnyJsonSchema | null {
  // Supports refs like "#/definitions/Address" or "#/$defs/Address".
  if (!pointer.startsWith('#/')) return null;

  const parts = pointer
    .slice(2)
    .split('/')
    .map((p) => decodeURIComponent(p.replace(/~1/g, '/').replace(/~0/g, '~')));

  let current: any = root;
  for (const part of parts) {
    if (current == null) return null;
    current = current[part];
  }
  return current ?? null;
}

function normalizeSchema(schema: AnyJsonSchema, root: AnyJsonSchema): AnyJsonSchema {
  let current: any = schema;

  // Dereference $ref chains.
  while (current && typeof current === 'object' && typeof current.$ref === 'string') {
    const resolved = resolveJsonPointer(root, current.$ref);
    if (!resolved) break;
    current = resolved;
  }

  // Prefer the first non-null branch for unions.
  const union = current?.anyOf || current?.oneOf;
  if (Array.isArray(union) && union.length > 0) {
    const nonNull = union.find((s: any) => {
      const t = s?.type;
      if (t === 'null') return false;
      if (Array.isArray(t) && t.includes('null') && t.length === 1) return false;
      return true;
    });
    if (nonNull) return normalizeSchema(nonNull, root);
  }

  // If allOf is present, pick the first schema (good enough for our prototype usage).
  if (Array.isArray(current?.allOf) && current.allOf.length > 0) {
    return normalizeSchema(current.allOf[0], root);
  }

  return current;
}

const createDefaultUsingSchema = (schema: AnyJsonSchema, rootSchema: AnyJsonSchema): any => {
  const resolved = normalizeSchema(schema, rootSchema);

  if (resolved?.default !== undefined) return resolved.default;
  if (resolved?.const !== undefined) return resolved.const;
  if (Array.isArray(resolved?.enum) && resolved.enum.length > 0) return resolved.enum[0];

  // Create a default item based on the schema
  if (resolved?.type === 'object' && resolved.properties) {
    const defaultItem: any = {};
    for (const key in resolved.properties) {
      const propSchema = normalizeSchema(resolved.properties[key], rootSchema);

      if (propSchema?.default !== undefined) {
        defaultItem[key] = propSchema.default;
        continue;
      }

      if (propSchema?.const !== undefined) {
        defaultItem[key] = propSchema.const;
        continue;
      }

      if (Array.isArray(propSchema?.enum) && propSchema.enum.length > 0) {
        defaultItem[key] = propSchema.enum[0];
        continue;
      }

      if (propSchema?.type === 'string') {
        if (propSchema.format === 'email') defaultItem[key] = 'user@example.com';
        else if (typeof propSchema.minLength === 'number' && propSchema.minLength > 0) defaultItem[key] = 'New employee';
        else defaultItem[key] = '';
        continue;
      }

      if (propSchema?.type === 'number' || propSchema?.type === 'integer') {
        defaultItem[key] = typeof propSchema.minimum === 'number' ? propSchema.minimum : 0;
        continue;
      }

      if (propSchema?.type === 'boolean') {
        defaultItem[key] = false;
        continue;
      }

      if (propSchema?.type === 'object') {
        defaultItem[key] = createDefaultUsingSchema(propSchema, rootSchema);
        continue;
      }

      if (propSchema?.type === 'array') {
        defaultItem[key] = [];
        continue;
      }

      defaultItem[key] = null;
    }

    return defaultItem;
  }

  if (resolved?.type === 'array') {
    return [];
  }

  if (resolved?.type === 'string') return '';
  if (resolved?.type === 'number' || resolved?.type === 'integer') return typeof resolved.minimum === 'number' ? resolved.minimum : 0;
  if (resolved?.type === 'boolean') return false;

  return null;
}

// Helper to set nested value by JSON-path ($.prop or prop.nested)
function setByPath(json: any, path: string, value: any) {
  const fieldName = path.split(".").reverse()[0]
  const targetObj = getParentOfTargetPath(json, path);

  targetObj[fieldName] = value;
}

// Extract field type info from JSON Schema for coercion
function getFieldType(
  schema: JSONSchemaType<any>,
  path: string
): { type: string; schema: JSONSchemaType<any> } | null {
  // Remove leading $ if present
  let cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;

  // Remove any array indices like [0]
  cleanPath = cleanPath.replace(/\[\d*\]/g, '');

  const parts = cleanPath.split('.').filter(Boolean);
  let current: any = schema;
  if (!current) return null;

  for (const part of parts) {
    current = normalizeSchema(current, schema);

    if (current?.type === 'object' && current.properties) {
      current = current.properties[part];
      continue;
    }

    if (current?.type === 'array' && current.items) {
      const items = normalizeSchema(current.items, schema);
      if (items?.type === 'object' && items.properties) {
        current = items.properties[part];
        continue;
      }
      return null;
    }

    // non-object, non-array
    return null;
  }

  current = normalizeSchema(current, schema);

  return {
    type: current?.type || 'string',
    schema: current,
  };
}

export default async function Page(
  props: {
    params: Promise<{
      url_scheme: 'http' | 'https';
      hostname: string;
      path: string[];
    }>;
  }
) {
  const params = await props.params;
  const targetUrl = `${params.url_scheme}://${decodeURIComponent(
    params.hostname
  )}/${decodeURIComponent(params.path.join('/'))}`;

  let spec: FormViewSpec | null = null;
  let entity: any = null;
  try {
    const res = await fetch(targetUrl, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      spec = data.spec as FormViewSpec;
      entity = data.entity;
    }
  } catch (err) {
    console.error('Failure fetching data for render', err);
  }

  if (!spec || !entity) {
    return <FormShell>
      <div data-testid="skeleton-wip">WIP</div>
    </FormShell>
  }

  const specNonNull = spec as FormViewSpec;
  const entityNonNull = entity;
  const baseOrigin = new URL(targetUrl).origin;

  async function submitAction(formData: FormData): Promise<SubmitResult> {
    'use server';

    const valuePathToFieldPath = (fieldName: string) => fieldName.replace(/\[\d*\]/, "[]");

    // Determine which fields are allowed to be sent (using JSON-path format)
    const allowFieldSet =
      Array.isArray(specNonNull.updateAction.allowFields) && specNonNull.updateAction.allowFields.length > 0
        ? new Set(specNonNull.updateAction.allowFields)
        : null; // null => allow all posted fields

    const isFieldAllowed = (fieldName: string) => {
      if (!allowFieldSet) return true;

      return allowFieldSet.has(valuePathToFieldPath(fieldName));
    }

    // Coerce string values based on JSON Schema type
    function coerceValue(fieldType: { type: string; schema: JSONSchemaType<any> }, raw: string): any {
      if (fieldType.type === 'number' || fieldType.type === 'integer') {
        // Interpret empty string as null to avoid NaN
        if (raw.trim() === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      if (fieldType.type === 'boolean') {
        return raw === 'true';
      }
      if (fieldType.schema.enum && Array.isArray(fieldType.schema.enum)) {
        // If enum contains numeric values, coerce accordingly
        const numValue = Number(raw);
        if (!isNaN(numValue) && fieldType.schema.enum.includes(numValue)) {
          return numValue;
        }
        return raw;
      }
      // Default: keep string
      return raw;
    }

    const payload: any = JSON.parse(JSON.stringify(entityNonNull));  // hack deep copy
    formData.forEach((value, postedName) => {
      if (typeof value !== 'string') return; // ignore File for now

      // Check if this field is allowed
      if (!isFieldAllowed(postedName)) return;

      // Get field type from schema
      const fieldType = getFieldType(specNonNull.schema, postedName);
      if (!fieldType) return; // not in schema

      const coerced = coerceValue(fieldType, value);
      // Skip undefined; allow null for explicit clearing when supported by backend
      if (coerced === undefined) return;
      setByPath(payload, postedName, coerced);
    });

    const submitUrl = new URL(specNonNull.updateAction.url, baseOrigin).toString();

    try {
      const res = await fetch(submitUrl, {
        method: specNonNull.updateAction.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-cache',
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        return { ok: false, message: msg };
      }
      return { ok: true, message: 'Saved successfully' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  }

  async function deleteAction(formData: FormData): Promise<SubmitResult> {
    'use server';

    if (!specNonNull.deleteAction) {
      return { ok: false, message: 'Delete not configured' };
    }

    const deleteUrl = new URL(specNonNull.deleteAction.url, baseOrigin).toString();

    try {
      const res = await fetch(deleteUrl, {
        method: specNonNull.deleteAction.method,
        cache: 'no-cache',
      });
      if (!res.ok) {
        let msg = `Delete failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        return { ok: false, message: msg };
      }
      return { ok: true, message: 'Deleted successfully' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  }

  async function arrayAddAction(formAction: string): Promise<SubmitResult> {
    'use server';

    // Get the field path from the formData or URL
    const fieldPathMatch = formAction.match(/field\=([^&]*)/);
    if (!fieldPathMatch) {
      return { ok: false, message: 'Field path not specified' };
    }

    const fieldPath = decodeURIComponent(fieldPathMatch[1]);  // parse the match group

    // Clone the entity and add a new item to the array
    const updatedEntity = JSON.parse(JSON.stringify(entityNonNull));

    // Navigate to the array field
    const current = getParentOfTargetPath(updatedEntity, fieldPath)

    const arrayFieldName = fieldPath.split('.').reverse()[0];
    if (!Array.isArray(current[arrayFieldName])) {
      current[arrayFieldName] = [];
    }

    // Navigate through schema to find the array field schema, and create a default entry
    const itemSchema = getFieldType(specNonNull.schema, fieldPath)?.schema.items;
    const defaultItem: any = createDefaultUsingSchema(itemSchema, specNonNull.schema);

    current[arrayFieldName].push(defaultItem);

    // Submit the updated entity
    const submitUrl = new URL(specNonNull.updateAction.url, baseOrigin).toString();

    try {
      const res = await fetch(submitUrl, {
        method: specNonNull.updateAction.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntity),
        cache: 'no-cache',
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        return { ok: false, message: msg };
      }
      return { ok: true, message: 'Item added successfully' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  }

  async function arrayRemoveAction(formAction: string): Promise<SubmitResult> {
    'use server';

    // Get the field path and index from the formData
    const fieldPathMatch = formAction.match(/field\=([^&]*)/);
    const indexStrMatch = formAction.match(/index\=([^&]*)/);
    if (!fieldPathMatch || !indexStrMatch) {
      return { ok: false, message: `Missing data fieldPathMatch: ${fieldPathMatch}, indexStrMatch: ${indexStrMatch}` };
    }

    // get capture group-ed parts of matches
    const fieldPath = decodeURIComponent(fieldPathMatch[1]);
    const indexStr = indexStrMatch[1];

    const index = parseInt(indexStr, 10);
    if (isNaN(index)) {
      return { ok: false, message: 'Invalid index' };
    }

    // Clone the entity and remove the item from the array
    const updatedEntity = JSON.parse(JSON.stringify(entityNonNull));
    const current = getParentOfTargetPath(updatedEntity, fieldPath);
    const fieldName = fieldPath.split(".").reverse()[0]

    // Remove the item at the specified index
    current[fieldName].splice(index, 1);

    // Submit the updated entity
    const submitUrl = new URL(specNonNull.updateAction.url, baseOrigin).toString();

    try {
      const res = await fetch(submitUrl, {
        method: specNonNull.updateAction.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntity),
        cache: 'no-cache',
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        return { ok: false, message: msg };
      }
      return { ok: true, message: 'Item removed successfully' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Network error' };
    }
  }

  return (
    <FormShell
      submitAction={submitAction}
      deleteAction={specNonNull.deleteAction ? deleteAction : undefined}
      arrayAddAction={arrayAddAction}
      arrayRemoveAction={arrayRemoveAction}
    >
      <FormViewServerRenderer spec={specNonNull} entity={entityNonNull} />
    </FormShell>
  );
}

