// Simple theme renderer for FormView
// Renders forms with Material-UI components in a clean, straightforward style

import React from 'react';
import { Box, Button, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { type JSONSchemaType } from 'ajv';
import { type FormViewSpec, type FieldPath } from '@/api/FormView';

// ============================================================================
// Utility Functions
// ============================================================================

// Utility to read nested values by JSON-path notation
function getByPath(obj: any, path: FieldPath): any {
  // Remove leading $ if present
  const cleanPath = path.startsWith('$.') ? path.substring(2) : path.startsWith('$') ? path.substring(1) : path;

  if (!cleanPath) return obj;

  const parts = cleanPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;

    // Handle array notation []
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      current = key ? current[key] : current;
      // Return the array itself for array fields
      return current;
    }

    current = current[part];
  }

  return current;
}

// Get label from JSON Schema (from title or property name)
function getLabel(schema: JSONSchemaType<any> | any, fieldName: string): string {
  if (schema.title) return schema.title;
  if (schema.description) return schema.description;
  // Convert camelCase to Title Case
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ============================================================================
// Simple Theme Renderer
// ============================================================================

export function FormViewServerRenderer<T>({ spec, entity }: { spec: FormViewSpec; entity: T }) {
  const { title, schema, submit } = spec;
  const deleteSpec = spec.delete;
  const isEditable = (path: FieldPath) =>
    submit.allowFields.length === 0 || submit.allowFields.includes(path);

  // Render fields from JSON Schema properties
  const renderFields = (schemaObj: JSONSchemaType<any> | any, parentPath = '$'): React.JSX.Element[] => {
    if (!schemaObj.properties) return [];

    const fields: React.JSX.Element[] = [];

    for (const fieldName in schemaObj.properties) {
      const fieldSchema = schemaObj.properties[fieldName];
      const fieldPath = `${parentPath}.${fieldName}`;
      const label = getLabel(fieldSchema, fieldName);
      const disabled = !isEditable(fieldPath);

      // Handle arrays with add/remove buttons
      if (fieldSchema.type === 'array') {
        const arrayValue = getByPath(entity, fieldPath) || [];
        const itemSchema = fieldSchema.items;

        fields.push(
          <Box key={fieldPath} sx={{ mt: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">{label}</Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                variant="outlined"
                disabled={disabled}
                type="submit"
                formAction={`?/arrayAdd&field=${encodeURIComponent(fieldPath)}`}
                name="_arrayAdd"
                value={fieldPath}
              >
                Add {fieldName}
              </Button>
            </Box>
            {Array.isArray(arrayValue) && arrayValue.map((item: any, index: number) => (
              <Box
                key={`${fieldPath}[${index}]`}
                sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1, position: 'relative' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {label} #{index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={disabled}
                    type="submit"
                    formAction={`?/arrayRemove&field=${encodeURIComponent(fieldPath)}&index=${index}`}
                    name="_arrayRemove"
                    value={`${fieldPath}:${index}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                {itemSchema.type === 'object'
                  ? renderFields(itemSchema, `${fieldPath}[${index}]`)
                  : renderPrimitiveField(itemSchema, `${fieldPath}[${index}]`, item, disabled)}
              </Box>
            ))}
            {(!arrayValue || arrayValue.length === 0) && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No items yet. Click "Add {fieldName}" to create one.
              </Typography>
            )}
          </Box>
        );
        continue;
      }

      // Handle nested objects as groups
      if (fieldSchema.type === 'object') {
        fields.push(
          <Box key={fieldPath} sx={{ pl: 2, borderLeft: '2px solid #eee', mt: 1 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {label}
            </Typography>
            {renderFields(fieldSchema, fieldPath)}
          </Box>
        );
        continue;
      }

      // Handle primitive fields
      const value = getByPath(entity, fieldPath) ?? '';
      fields.push(renderPrimitiveField(fieldSchema, fieldPath, value, disabled));
    }

    return fields;
  };

  // Render a primitive field (string, number, boolean, enum)
  const renderPrimitiveField = (
    fieldSchema: any,
    fieldPath: string,
    value: any,
    disabled: boolean
  ): React.JSX.Element => {
    const label = getLabel(fieldSchema, fieldPath.split('.').pop() || '');

    const commonProps = {
      key: fieldPath,
      name: fieldPath,
      label,
      defaultValue: value ?? '',
      fullWidth: true,
      margin: 'normal' as const,
      disabled,
    };

    // Handle enums as select
    if (fieldSchema.enum) {
      return (
        <TextField select {...commonProps}>
          {fieldSchema.enum.map((val: any) => (
            <MenuItem key={String(val)} value={val}>
              {String(val)}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    // Infer input type from JSON Schema type
    if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
      return <TextField type="number" {...commonProps} />;
    } else if (fieldSchema.type === 'boolean') {
      return (
        <TextField select {...commonProps}>
          <MenuItem value="true">Yes</MenuItem>
          <MenuItem value="false">No</MenuItem>
        </TextField>
      );
    }

    return <TextField type="text" {...commonProps} />;
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          {title}
        </Typography>
        {deleteSpec && (
          <Button
            type="submit"
            variant="outlined"
            color="error"
            formAction="?/delete"
          >
            Delete
          </Button>
        )}
      </Box>
      {renderFields(schema)}
    </Box>
  );
}

