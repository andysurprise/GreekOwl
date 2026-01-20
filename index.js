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

    const polygonKey = env.POLYGON_API_KEY;

    const priceResp = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${polygonKey}`
    );
    const priceData = await priceResp.json();

    const dividendResp = await fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=1&apiKey=${polygonKey}`
    );
    const dividendData = await dividendResp.json();

    return new Response(
      JSON.stringify({
        symbol,
        price: priceData?.results?.[0]?.c ?? null,
        dividend: dividendData?.results?.[0] ?? null
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
