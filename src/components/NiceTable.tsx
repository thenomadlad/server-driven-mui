import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

export interface TableRow {
  [key: string]: string | number | Date;
}

export interface NiceTableProps {
  headings: string[];
  rows: TableRow[];
}

function CellByType({
  cellData,
  ...props
}: {
  cellData: string | number | Date;
  [x: string]: any;
}) {
  if (typeof cellData === "number") {
    return <TableCell align="right">{cellData}</TableCell>;
  }
  return <TableCell {...props}>{cellData.toString()}</TableCell>;
}

export default function NiceTable({
  headings,
  rows,
}: {
  headings: string[];
  rows: TableRow[];
}) {
  const firstHeading = headings[0];

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            {headings.map((heading) => (
              <CellByType cellData={heading} />
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={JSON.stringify(row)}
              sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
            >
              {Object.keys(row).map((rowKey) => {
                if (rowKey === firstHeading) {
                  return (
                    <CellByType
                      cellData={row[rowKey]}
                      component="th"
                      scope="row"
                    />
                  );
                } else {
                  return <CellByType cellData={row[rowKey]} />;
                }
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
