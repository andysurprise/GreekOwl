export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: "Missing symbol parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const key = env.POLYGON_API_KEY;

    const resp = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${key}`
    );

    const json = await resp.json();

    return new Response(
      JSON.stringify({
        status: resp.status,
        raw: json
      }, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
