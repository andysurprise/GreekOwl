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

    // --- Price snapshot (reliable) ---
    const priceResp = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${key}`
    );
    const priceJson = await priceResp.json();

    const price =
      priceJson?.ticker?.lastTrade?.p ??
      priceJson?.ticker?.day?.c ??
      null;

    // --- Dividend lookup ---
    const dividendResp = await fetch(
      `https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=1&sort=ex_dividend_date&order=desc&apiKey=${key}`
    );
    const dividendJson = await dividendResp.json();

    const dividend = dividendJson?.results?.[0] ?? null;

    return new Response(
      JSON.stringify({
        symbol,
        price,
        dividend
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
