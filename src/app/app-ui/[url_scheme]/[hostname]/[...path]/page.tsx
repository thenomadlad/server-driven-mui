// Skeleton SDMUI route as outlined in the roadmap.
// For now, this builds the target backend URL from the route params,
// fetches it (no-cache), and renders a simple WIP placeholder.
// Later iterations will render UI based on the returned data.

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

  // Attempt to fetch the backend data, but don't block rendering the WIP UI if it fails
  // or if the response is not JSON. This is intentionally tolerant for the skeleton stage.
  try {
    const res = await fetch(targetUrl, { cache: 'no-cache' });
    // We don't use the data yet, but this ensures the request happens now.
    await res.text();
  } catch (err) {
    // Swallow errors in the skeleton phase; future iterations will surface errors to users
  }

  return (
    <div>
      <div data-testid="skeleton-wip">WIP</div>
    </div>
  );
}

