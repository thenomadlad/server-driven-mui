// Generic FormView for single-entity forms with JSON Schema support
// Build forms from JSON Schema with automatic field rendering
// - Optionally constrain editable fields via forUpdateCommand() by passing a JSON Schema
// - Renderer respects allowed fields and sets inputs to read-only when disallowed
// - Supports arrays with add/remove buttons

import { type JSONSchemaType } from 'ajv';

// ============================================================================
// Type Definitions
// ============================================================================

// JSON-path format: $.property, $.array[], $.nested.property
export type FieldPath = string;

export interface SubmitAction {
  method: 'POST' | 'PUT' | 'PATCH';
  url: string;
  // JSON-path allowed fields for submission and editability
  allowFields: FieldPath[];
}

export interface DeleteAction {
  method: 'DELETE';
  url: string;
}

export interface FormViewSpec {
  type: 'form';
  title: string;
  schema: JSONSchemaType<any>;
  updateAction: SubmitAction;
  deleteAction?: DeleteAction;
}

// ============================================================================
// Utility Functions
// ============================================================================

// Extract field paths from JSON Schema (keep as-is per requirements)
function extractFieldPaths(schema: JSONSchemaType<any>, prefix = '$'): FieldPath[] {
  const paths: FieldPath[] = [];

  if (schema.type === 'object' && schema.properties) {
    for (const key in schema.properties) {
      const fieldPath = `${prefix}.${key}`;
      const propSchema = schema.properties[key];

      if (propSchema.type === 'object') {
        paths.push(...extractFieldPaths(propSchema, fieldPath));
      } else if (propSchema.type === 'array') {
        // Include the array field itself
        paths.push(fieldPath);
        // Also include nested paths within array items
        const arrayItemPath = `${fieldPath}[]`;
        const itemSchema = propSchema.items;
        if (itemSchema.type === 'object' || itemSchema.type === 'array') {
          paths.push(...extractFieldPaths(itemSchema, arrayItemPath));
        } else {
          paths.push(arrayItemPath);
        }
      } else {
        paths.push(fieldPath);
      }
    }
  } else if (schema.type === 'array' && schema.items) {
    const fieldPath = `${prefix}[]`;
    const propSchema = schema.items;

    if (propSchema.type === 'object' || propSchema.type === 'array') {
      paths.push(...extractFieldPaths(propSchema, fieldPath));
    } else {
      paths.push(fieldPath);
    }
  }

  return paths;
}

// ============================================================================
// FormView Class
// ============================================================================

export class FormView<T> {
  private spec: FormViewSpec;
  private _entity: T;

  private constructor(spec: FormViewSpec, entity: T) {
    this.spec = spec;
    this._entity = entity;
  }

  get entity(): T {
    return this._entity;
  }

  /**
   * Create a FormView builder from a JSON Schema.
   * This is the only way to construct a FormView.
   */
  static fromSchema(schema: JSONSchemaType<any>, title: string): FormViewBuilder {
    return new FormViewBuilder(schema, title);
  }

  // Expose spec for testing/inspection and JSON serialization
  toSpec(): FormViewSpec {
    return this.spec;
  }

  toJSON(): { spec: FormViewSpec; entity: T } {
    return { spec: this.spec, entity: this._entity };
  }

  /**
   * Internal method used by FormViewBuilder to construct FormView instances
   * @internal
   */
  static _internal_create<T>(spec: FormViewSpec, entity: T): FormView<T> {
    return new FormView<T>(spec, entity);
  }
}

// ============================================================================
// FormView Builder
// ============================================================================

export class FormViewBuilder {
  private schema: JSONSchemaType<any>;
  private titleText: string;
  private updateAction: SubmitAction = { method: 'POST', url: '#', allowFields: [] };
  private deleteAction?: DeleteAction;

  constructor(schema: JSONSchemaType<any>, title: string) {
    this.schema = schema;
    this.titleText = title;
  }

  /**
   * Define which fields are editable by passing an update schema.
   * Only fields present in the update schema will be editable.
   */
  forUpdateCommand(updateSchema: JSONSchemaType<any>): this {
    const allowFields = extractFieldPaths(updateSchema);
    this.updateAction = { ...this.updateAction, allowFields };
    return this;
  }

  /**
   * Configure form submission
   */
  submit(def: Partial<SubmitAction>): this {
    this.updateAction = { ...this.updateAction, ...def };
    return this;
  }

  /**
   * Configure delete action
   */
  delete(def: DeleteAction): this {
    this.deleteAction = def;
    return this;
  }

  /**
   * Build the FormView for a specific entity
   * This method can be called multiple times with different entities
   */
  buildForEntity<T>(entity: T): FormView<T> {
    const spec: FormViewSpec = {
      type: 'form',
      title: this.titleText,
      schema: this.schema,
      updateAction: this.updateAction,
      ...(this.deleteAction && { deleteAction: this.deleteAction }),
    };
    return FormView._internal_create<T>(spec, entity);
  }
}

