import { type FormViewSpec } from '@/api/FormView';
import { FormViewServerRenderer } from '@/theme/simple';
import FormShell, { type SubmitResult } from '@/components/FormShell';
import { type JSONSchemaType } from 'ajv';

// Server-side SDMUI route
// - Builds the target backend URL from route params
// - Fetches a FormViewSpec from the backend
// - Renders a fully server-side form that submits to a Next.js Server Action
// - The server action filters fields per allowFields and forwards JSON to the backend submit URL

// Helper to set nested value by JSON-path ($.prop or prop.nested)
function setByPath(obj: any, path: string, value: any) {
  // Remove leading $ if present
  const cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;

  const parts = cleanPath.split('.');
  const last = parts.pop() as string;
  const target = parts.reduce((acc, k) => {
    if (acc[k] == null || typeof acc[k] !== 'object') acc[k] = {};
    return acc[k];
  }, obj);
  target[last] = value;
}

// Extract field type info from JSON Schema for coercion
function getFieldType(schema: JSONSchemaType<any>, path: string): { type: string; enum?: any[] } | null {
  // Remove leading $ if present
  const cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;

  const parts = cleanPath.split('.');
  let current: any = schema;

  for (const part of parts) {
    if (!current || current.type !== 'object' || !current.properties) return null;
    current = current.properties[part];
    if (!current) return null;
  }

  return {
    type: current.type || 'string',
    enum: current.enum,
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
    return <div data-testid="skeleton-wip">WIP</div>;
  }

  const specNonNull = spec as FormViewSpec;
  const entityNonNull = entity;
  const baseOrigin = new URL(targetUrl).origin;

  async function submitAction(formData: FormData): Promise<SubmitResult> {
    'use server';

    // Determine which fields are allowed to be sent (using JSON-path format)
    const allow =
      Array.isArray(specNonNull.submit.allowFields) && specNonNull.submit.allowFields.length > 0
        ? new Set(specNonNull.submit.allowFields)
        : null; // null => allow all posted fields

    // Coerce string values based on JSON Schema type
    function coerceValue(fieldType: { type: string; enum?: any[] }, raw: string): any {
      if (fieldType.type === 'number' || fieldType.type === 'integer') {
        // Interpret empty string as null to avoid NaN
        if (raw.trim() === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      if (fieldType.type === 'boolean') {
        return raw === 'true';
      }
      if (fieldType.enum && Array.isArray(fieldType.enum)) {
        // If enum contains numeric values, coerce accordingly
        const numValue = Number(raw);
        if (!isNaN(numValue) && fieldType.enum.includes(numValue)) {
          return numValue;
        }
        return raw;
      }
      // Default: keep string
      return raw;
    }

    const payload: any = {};
    formData.forEach((value, postedName) => {
      if (typeof value !== 'string') return; // ignore File for now

      // Check if this field is allowed
      if (allow && !allow.has(postedName)) return;

      // Get field type from schema
      const fieldType = getFieldType(specNonNull.schema, postedName);
      if (!fieldType) return; // not in schema

      const coerced = coerceValue(fieldType, value);
      // Skip undefined; allow null for explicit clearing when supported by backend
      if (coerced === undefined) return;
      setByPath(payload, postedName, coerced);
    });

    const submitUrl = new URL(specNonNull.submit.url, baseOrigin).toString();

    try {
      const res = await fetch(submitUrl, {
        method: specNonNull.submit.method,
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

    if (!specNonNull.delete) {
      return { ok: false, message: 'Delete not configured' };
    }

    const deleteUrl = new URL(specNonNull.delete.url, baseOrigin).toString();

    try {
      const res = await fetch(deleteUrl, {
        method: specNonNull.delete.method,
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

  return (
    <FormShell action={submitAction} deleteAction={specNonNull.delete ? deleteAction : undefined}>
      <FormViewServerRenderer spec={specNonNull} entity={entityNonNull} />
    </FormShell>
  );
}

