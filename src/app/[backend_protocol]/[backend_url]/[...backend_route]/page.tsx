import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const SDUI_COMPONENTS = {
  Table: (sdui_data: SduiData) => (
    <Table {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </Table>
  ),
  TableBody: (sdui_data: SduiData) => (
    <TableBody {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </TableBody>
  ),
  TableCell: (sdui_data: SduiData) => (
    <TableCell {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </TableCell>
  ),
  TableContainer: (sdui_data: SduiData) => (
    <TableContainer {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </TableContainer>
  ),
  TableHead: (sdui_data: SduiData) => (
    <TableHead {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </TableHead>
  ),
  TableRow: (sdui_data: SduiData) => (
    <TableRow {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </TableRow>
  ),
  Paper: (sdui_data: SduiData) => (
    <Paper {...sdui_data.props}>
      {renderSduiComponent(sdui_data.children)}
    </Paper>
  ),
};

interface SduiData {
  component: keyof typeof SDUI_COMPONENTS;
  props?: { [k: string]: string };
  children?: SduiData[] | string;
}

function renderSduiComponent(sdui_data: SduiData[] | string | undefined) {
  if (sdui_data === undefined || typeof sdui_data === "string") {
    return sdui_data;
  }

  return (sdui_data as SduiData[]).map((sdui_piece) =>
    SDUI_COMPONENTS[sdui_piece.component](sdui_piece)
  );
}

export default async function Page({
  params,
}: {
  params: {
    backend_protocol: "http" | "https";
    backend_url: string;
    backend_route: [string];
  };
}) {
  let sdui_data: SduiData[] = [];
  let res = await fetch(
    params.backend_protocol +
      "://" +
      decodeURIComponent(params.backend_url) +
      "/" +
      decodeURIComponent(params.backend_route.join("/")) +
      "/_sdui",
    { cache: "no-cache" }
  );

  if (!res.ok) {
    throw new Error("Blah blah blah");
  } else {
    sdui_data = await res.json();
  }

  return (
    <>
      <h1>Hello, Next.js! {`${JSON.stringify(params)}`}</h1>
      {renderSduiComponent(sdui_data)}
    </>
  );
}
