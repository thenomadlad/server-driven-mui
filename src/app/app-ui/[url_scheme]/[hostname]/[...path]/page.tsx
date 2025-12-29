import { FormViewServerRenderer, type FormViewSpec, type FieldDef } from '@/api/FormView';
import FormShell, { type SubmitResult } from '@/components/FormShell';


// Server-side SDMUI route
// - Builds the target backend URL from route params
// - Fetches a FormViewSpec from the backend
// - Renders a fully server-side form that submits to a Next.js Server Action
// - The server action filters fields per allowFields and forwards JSON to the backend submit URL

function setByPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  const last = parts.pop() as string;
  const target = parts.reduce((acc, k) => {
    if (acc[k] == null || typeof acc[k] !== 'object') acc[k] = {};
    return acc[k];
  }, obj);
  target[last] = value;
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

  let spec: FormViewSpec<any> | null = null;
  try {
    const res = await fetch(targetUrl, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      spec = data as FormViewSpec<any>;
    }
  } catch (err) {
    console.error("Failure fetching data for render", err);
  }

  if (!spec) {
    return <div data-testid="skeleton-wip">WIP</div>;
  }

  const specNonNull = spec as FormViewSpec<any>;
  const baseOrigin = new URL(targetUrl).origin;

  async function submitAction(formData: FormData): Promise<SubmitResult> {
    'use server';

    // Flatten fields from spec, computing fully-qualified dot paths for nested groups
    function flattenFields(fields: FieldDef[], prefix = ''): Array<{ path: string; def: FieldDef }> {
      const out: Array<{ path: string; def: FieldDef }> = [];
      for (const f of fields) {
        const full = prefix ? `${prefix}.${f.name}` : f.name;
        if (f.input === 'group' && Array.isArray(f.children)) {
          out.push(...flattenFields(f.children, full));
        } else {
          out.push({ path: full, def: f });
        }
      }
      return out;
    }

    const flat = flattenFields(specNonNull.fields);
    const fieldMap = new Map<string, FieldDef>(flat.map(({ path, def }) => [path, def]));

    // Determine which fields are allowed to be sent
    const allow = Array.isArray(specNonNull.submit.allowFields) && specNonNull.submit.allowFields.length > 0
      ? new Set(specNonNull.submit.allowFields)
      : null; // null => allow all posted fields

    // Try to resolve a posted name to a fully-qualified path from the spec
    function resolvePath(name: string): string | null {
      if (fieldMap.has(name)) return name;
      // Fallback: match by suffix if the spec used nested paths but inputs used short names
      const candidates = flat.filter(f => f.path.endsWith(`.${name}`));
      if (candidates.length === 1) return candidates[0].path;
      return null;
    }

    // Coerce string values based on field definition
    function coerceValue(def: FieldDef, raw: string): any {
      if (def.input === 'number') {
        // Interpret empty string as null to avoid NaN
        if (raw.trim() === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      }
      if (def.input === 'select' && Array.isArray(def.options)) {
        // If options contain numeric values, coerce accordingly
        const opt = def.options.find(o => String(o.value) === raw);
        return opt ? opt.value : raw;
      }
      // Default: keep string
      return raw;
    }

    const payload: any = {};
    formData.forEach((value, postedName) => {
      if (typeof value !== 'string') return; // ignore File for now
      const path = resolvePath(postedName);
      if (!path) return; // not in spec
      if (allow && !allow.has(path)) return; // not allowed by spec
      const def = fieldMap.get(path)!;
      const coerced = coerceValue(def, value);
      // Skip undefined; allow null for explicit clearing when supported by backend
      if (coerced === undefined) return;
      setByPath(payload, path, coerced);
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

  return (
    <FormShell action={submitAction}>
      <FormViewServerRenderer spec={specNonNull} />
    </FormShell>
  );
}

