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

// Helper to set nested value by JSON-path ($.prop or prop.nested)
function setByPath(json: any, path: string, value: any) {
  const fieldName = path.split(".").reverse()[0]
  const targetObj = getParentOfTargetPath(json, path);

  targetObj[fieldName] = value;
}

// Extract field type info from JSON Schema for coercion
function getFieldType(schema: JSONSchemaType<any>, path: string): { type: string; enum?: any[] } | null {
  // Remove leading $ if present
  let cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;

  // Remove array notation stuff if present
  cleanPath = cleanPath.replace(/\[\d*\]/, "")

  const parts = cleanPath.split('.');
  let current: any = schema;
  if (!current) return null;

  for (const part of parts) {
    if (current.type === 'object') {
      current = current.properties[part];
    } else if (current.type === 'array' && current.items.type === 'object') {
      current = current.items.properties[part];
    } else {
      // non-object, non-array
      return null;
    }
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

  async function arrayAddAction(formData: FormData): Promise<SubmitResult> {
    'use server';

    // Get the field path from the formData or URL
    const fieldPath = formData.get('_arrayAdd') as string;
    if (!fieldPath) {
      return { ok: false, message: 'Field path not specified' };
    }

    // Clone the entity and add a new item to the array
    const updatedEntity = JSON.parse(JSON.stringify(entityNonNull));

    // Navigate to the array field
    const pathParts = fieldPath.replace(/^\$\.?/, '').split('.');
    let current: any = updatedEntity;

    // Navigate to the parent of the array field
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (current[pathParts[i]] === undefined) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }

    const arrayFieldName = pathParts[pathParts.length - 1];
    if (!Array.isArray(current[arrayFieldName])) {
      current[arrayFieldName] = [];
    }

    // Navigate through schema to find the array field schema
    let schemaNode: any = specNonNull.schema;
    for (const part of pathParts) {
      if (schemaNode.type === 'object' && schemaNode.properties) {
        schemaNode = schemaNode.properties[part];
      } else {
        schemaNode = null;
        break;
      }
    }

    const itemSchema = schemaNode?.items;

    // Create a default item based on the schema
    let defaultItem: any = {};
    if (itemSchema?.type === 'object' && itemSchema.properties) {
      for (const key in itemSchema.properties) {
        const propSchema = itemSchema.properties[key];
        // Set default values based on type
        if (propSchema.type === 'string') defaultItem[key] = '';
        else if (propSchema.type === 'number' || propSchema.type === 'integer') defaultItem[key] = 0;
        else if (propSchema.type === 'boolean') defaultItem[key] = false;
        else if (propSchema.type === 'object') defaultItem[key] = {};
        else if (propSchema.type === 'array') defaultItem[key] = [];
        else defaultItem[key] = null;
      }
    } else {
      // For primitive arrays
      defaultItem = '';
    }

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
    console.log(JSON.stringify(formAction));
    
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
      action={submitAction}
      deleteAction={specNonNull.deleteAction ? deleteAction : undefined}
      arrayAddAction={arrayAddAction}
      arrayRemoveAction={arrayRemoveAction}
    >
      <FormViewServerRenderer spec={specNonNull} entity={entityNonNull} />
    </FormShell>
  );
}

