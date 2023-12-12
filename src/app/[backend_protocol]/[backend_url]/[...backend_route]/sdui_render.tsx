import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import NiceTable, { NiceTableProps } from "../../../../components/NiceTable";
import { FunctionComponent, createElement } from "react";

// TODO: find a way to get around making a manual list like this
const SDUI_COMPONENTS = {
  Table: Table,
  TableBody: TableBody,
  TableCell: TableCell,
  TableContainer: TableContainer,
  TableHead: TableHead,
  TableRow: TableRow,
  Paper: Paper,
  NiceTable: NiceTable
}

export interface SduiData {
  component: keyof typeof SDUI_COMPONENTS;
  props?: { [k: string]: string };
  children?: SduiData[] | string;
}

export function renderSduiComponent(
  sdui_data: SduiData[] | string | undefined
): React.ReactElement[] | string | undefined {
  if (sdui_data === undefined || typeof sdui_data === "string") {
    return sdui_data;
  }

  return (sdui_data as SduiData[]).map((sdui_piece) =>
    createElement(
      SDUI_COMPONENTS[sdui_piece.component] as FunctionComponent,
      sdui_piece.props,
      renderSduiComponent(sdui_piece.children)
    )
  );
}
