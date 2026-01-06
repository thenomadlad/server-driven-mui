// Simple theme renderer for FormView
// Renders forms with Material-UI components in a clean, straightforward style

import React from 'react';
import { Box, Button, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { type JSONSchemaType } from 'ajv';
import { type FormViewSpec, type FieldPath } from '@/api/FormView';
import { JSONPath } from 'jsonpath-plus';

// ============================================================================
// Utility Functions
// ============================================================================

// Utility to read nested values by JSON-path notation
function getByPath(json: any, path: FieldPath): any {
  return JSONPath({path, json, flatten: true});
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
  const { title, schema, updateAction, deleteAction } = spec;
  const isEditable = (path: FieldPath) =>
    updateAction.allowFields.length === 0 || updateAction.allowFields.includes(path);

  // Render fields from JSON Schema properties
  const renderFields = (schemaObj: JSONSchemaType<any> | any, parentPath = '$', valueParentPath = "$"): React.JSX.Element[] => {
    if (!schemaObj.properties) return [];

    const fields: React.JSX.Element[] = [];

    for (const fieldName in schemaObj.properties) {
      const fieldSchema = schemaObj.properties[fieldName];
      const fieldPath = `${parentPath}.${fieldName}`;
      const valuePath = `${valueParentPath}.${fieldName}`;
      const label = getLabel(fieldSchema, fieldName);
      const disabled = !isEditable(fieldPath);

      // Handle arrays with add/remove buttons
      if (fieldSchema.type === 'array') {
        const arrayValue = getByPath(entity, valuePath) || [];
        const itemSchema = fieldSchema.items;
        console.log(`${JSON.stringify(entity)}, ${valuePath}, ${JSON.stringify(arrayValue)}`)

        fields.push(
          <Box key={valuePath} sx={{ mt: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">{label}</Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                variant="outlined"
                disabled={disabled}
                type="submit"
                formAction={`?/arrayAdd&field=${encodeURIComponent(valuePath)}`}
              >
                Add {fieldName}
              </Button>
            </Box>
            {Array.isArray(arrayValue) && arrayValue.map((item: any, index: number) => {
              const newParentPath = `${fieldPath}[]`;
              const newValueParentPath = `${valuePath}[${index}]`;

                return (
                    <Box
                        key={`${valuePath}[${index}]`}
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
                                formAction={`?/arrayRemove&field=${encodeURIComponent(valuePath)}&index=${index}`}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        {itemSchema.type === 'object'
                            ? renderFields(itemSchema, newParentPath, newValueParentPath)
                            : renderPrimitiveField(itemSchema, newParentPath, newValueParentPath, item, disabled)}
                    </Box>
                );
            })}
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
          <Box key={valuePath} sx={{ pl: 2, borderLeft: '2px solid #eee', mt: 1 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {label}
            </Typography>
            {renderFields(fieldSchema, fieldPath, valuePath)}
          </Box>
        );
        continue;
      }

      // Handle primitive fields
      const value = getByPath(entity, valuePath) ?? '';
      fields.push(renderPrimitiveField(fieldSchema, fieldPath, valuePath, value, disabled));
    }

    return fields;
  };

  // Render a primitive field (string, number, boolean, enum)
  const renderPrimitiveField = (
    fieldSchema: any,
    fieldPath: string,
    valuePath: string,
    value: any,
    disabled: boolean
  ): React.JSX.Element => {
    const label = getLabel(fieldSchema, fieldPath.split('.').pop() || '');

    const commonProps = {
      key: valuePath,
      name: valuePath,
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
        {deleteAction && (
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

