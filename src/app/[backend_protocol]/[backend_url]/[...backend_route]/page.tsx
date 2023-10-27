import { SduiData, renderSduiComponent } from "./sdui_render";

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
