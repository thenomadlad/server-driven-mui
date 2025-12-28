import * as React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

export interface NiceTableProps {
  columns?: string[];
  rows?: Array<Record<string, React.ReactNode> | React.ReactNode[]>;
}

/**
 * A minimal NiceTable component to support SDUI demos and typechecking.
 * This renders a simple table using MUI with optional columns and rows.
 */
export default function NiceTable({ columns = [], rows = [] }: NiceTableProps) {
  return (
    <TableContainer component={Paper}>
      <Table>
        {columns.length > 0 && (
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {rows.map((row, idx) => {
            if (Array.isArray(row)) {
              return (
                <TableRow key={idx}>
                  {row.map((cell, cidx) => (
                    <TableCell key={cidx}>{cell}</TableCell>
                  ))}
                </TableRow>
              );
            }
            // Object row: render in column order if provided, else object values order
            const keys = columns.length > 0 ? columns : Object.keys(row as Record<string, unknown>);
            return (
              <TableRow key={idx}>
                {keys.map((k) => (
                  <TableCell key={k}>{(row as Record<string, React.ReactNode>)[k]}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

