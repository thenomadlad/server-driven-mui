// Generic FormView for single-entity forms with optional update-command constraints
// Prototype 1: build a form description and render a MUI form for a given entity
// - Build from any entity T via a fluent builder
// - Optionally constrain editable fields via forUpdateCommand<U>() by passing a runtime "shape" of U
// - Renderer respects allowed fields and sets inputs to read-only when disallowed

import { Box, MenuItem, TextField, Typography } from '@mui/material';

// Primitive field inputs supported in prototype 1
export type InputKind = 'text' | 'number' | 'select' | 'group';

export type FieldPath = string; // dot notation e.g. "address.street1"

export interface FieldDef {
  name: FieldPath;
  label: string;
  input: InputKind;
  readOnly?: boolean;
  // For select inputs
  options?: Array<{ label: string; value: string | number }>;
  // For group inputs
  children?: FieldDef[];
}

export interface SubmitDef {
  method: 'POST' | 'PUT' | 'PATCH';
  url: string;
  // dot-notation allowed fields for submission and editability
  allowFields: FieldPath[];
}

export interface FormViewSpec<T> {
  type: 'form';
  title: string;
  fields: FieldDef[];
  submit: SubmitDef;
  entity: T;
}

// Utility to read nested values by dot notation
function getByPath(obj: any, path: FieldPath) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// DeepPartial helper for deriving update-command shapes at runtime
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(v: any) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

// Collect dot-notation paths for leaf properties of an object shape
function collectPaths(obj: any, prefix = ''): string[] {
  if (!isPlainObject(obj)) return [];
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    const val = (obj as any)[k];
    if (isPlainObject(val)) {
      out.push(...collectPaths(val, full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// Server-only renderer: no hooks, uncontrolled inputs; this renders only fields and layout
export function FormViewServerRenderer<T>({ spec }: { spec: FormViewSpec<T> }) {
  const { title, fields, entity, submit } = spec;
  const isEditable = (path: FieldPath) => submit.allowFields.length === 0 || submit.allowFields.includes(path);

  // Render a field, qualifying child names under a group with the parent path
  const renderField = (f: FieldDef, parentPath?: string) => {
    // Build a fully-qualified dot path for this field
    const qualifyName = (name: string, parent?: string) => {
      if (!parent) return name;
      // If the name appears to be absolute (starts with a top-level entity key), don't prefix
      const topKeys = entity && typeof entity === 'object' ? Object.keys(entity as any) : [];
      const firstSeg = name.split('.')[0];
      if (topKeys.includes(firstSeg)) return name;
      return `${parent}.${name}`;
    };

    const fullPath = qualifyName(f.name, parentPath);

    if (f.input === 'group') {
      return (
        <Box key={fullPath} sx={{ pl: 2, borderLeft: '2px solid #eee', mt: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {f.label}
          </Typography>
          {f.children?.map((child) => renderField(child, fullPath))}
        </Box>
      );
    }

    const value = getByPath(entity as any, fullPath) ?? '';
    const disabled = f.readOnly === true || !isEditable(fullPath);
    const commonProps = {
      key: fullPath,
      name: fullPath,
      label: f.label,
      defaultValue: value,
      fullWidth: true,
      margin: 'normal' as const,
      disabled,
    };
    if (f.input === 'select') {
      return (
        <TextField select {...commonProps}>
          {f.options?.map((opt) => (
            <MenuItem key={String(opt.value)} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }
    return <TextField type={f.input === 'number' ? 'number' : 'text'} {...commonProps} />;
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {fields.map((f) => renderField(f))}
    </Box>
  );
}

// FormView builder
export class FormView<T> {
  private spec: FormViewSpec<T>;

  constructor(spec: FormViewSpec<T>) {
    this.spec = spec;
  }

  static forEntity<T>(entity: T) {
    return new FormViewBuilder<T>(entity);
  }

  // Expose spec for testing/inspection and JSON serialization
  toSpec(): FormViewSpec<T> {
    return this.spec;
  }

  toJSON(): string {
    return JSON.stringify(this.spec);
  }

  static from<T>(spec: FormViewSpec<T>): FormView<T> {
    return new FormView<T>(spec);
  }

  static fromJSON<T>(json: string): FormView<T> {
    const spec = JSON.parse(json) as FormViewSpec<T>;
    return new FormView<T>(spec);
  }
}

// Fluent builder to construct a FormView for an entity
export class FormViewBuilder<T> {
  private entity: T;
  private titleText: string = 'Form';
  private fields: FieldDef[] = [];
  private submitDef: SubmitDef = { method: 'POST', url: '#', allowFields: [] };

  constructor(entity: T) {
    this.entity = entity;
  }

  title(title: string) {
    this.titleText = title;
    return this;
  }

  field(field: FieldDef) {
    this.fields.push(field);
    return this;
  }

  fieldsAll(fields: FieldDef[]) {
    this.fields.push(...fields);
    return this;
  }

  // Define which fields are editable by passing a runtime shape of T.
  // Only fields present in both the entity and the shape will be editable and included in the submit payload.
  forUpdateCommand(shape: DeepPartial<T>) {
    const candidate = new Set(collectPaths(shape));
    const intersection: FieldPath[] = [];
    // Intersect with actual fields present in the entity spec if possible
    const entityPaths = new Set(allFieldPathsFromEntity(this.entity));
    candidate.forEach((p) => {
      if (entityPaths.has(p)) intersection.push(p);
    });
    this.submitDef = { ...this.submitDef, allowFields: intersection };
    return this;
  }

  submit(def: SubmitDef) {
    this.submitDef = def;
    return this;
  }

  build(): FormView<T> {
    return new FormView<T>({ type: 'form', title: this.titleText, fields: this.fields, submit: this.submitDef, entity: this.entity });
  }
}

// Attempt to infer possible field paths from the provided entity instance at runtime
function allFieldPathsFromEntity(obj: any, prefix = ''): FieldPath[] {
  if (!isPlainObject(obj)) return [];
  const out: FieldPath[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (isPlainObject(v)) out.push(...allFieldPathsFromEntity(v, full));
    else out.push(full);
  }
  return out;
}

