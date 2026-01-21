const proxy = "https://greekowl-proxy.glance-muckier-7k.workers.dev";

const checklist = document.getElementById("checklist");
const context = document.getElementById("context");
const tickerContext = document.getElementById("tickerContext");

document.getElementById("validate").onclick = async () => {
  checklist.innerHTML = "";
  context.textContent = "";

  const ticker = document.getElementById("ticker").value.toUpperCase();
  const expiry = new Date(document.getElementById("expiry").value);
  const delta = parseFloat(document.getElementById("delta").value);
  const premium = parseFloat(document.getElementById("premium").value);

  const dte = Math.round((expiry - new Date()) / 86400000);

  addCheck(
    dte >= 20 && dte <= 50,
    `Days to expiration: ${dte}`,
    "Covered calls target 20–50 DTE to balance decay vs assignment risk."
  );

  addCheck(
    delta >= 0.3 && delta <= 0.4,
    `Delta: ${delta}`,
    "Delta approximates assignment probability. .30–.40 balances yield and safety."
  );

  addCheck(
    premium > 0,
    `Premium entered: ${premium}`,
    "Premium is required to define profit targets and risk controls."
  );

  loadTickerContext(ticker);
};

function addCheck(pass, text, explanation) {
  const li = document.createElement("li");
  li.className = pass ? "pass" : "fail";
  li.textContent = text;
  li.onclick = () => (context.textContent = explanation);
  checklist.appendChild(li);
}

async function loadTickerContext(ticker) {
  tickerContext.textContent = "Loading market data…";

  const res = await fetch(`${proxy}?symbol=${ticker}`);
  const data = await res.json();

  if (data.error) {
    tickerContext.textContent = data.error;
    return;
  }

  const price = data.price ?? "Unavailable";
  const hi = data.high30 ?? "—";
  const lo = data.low30 ?? "—";

  let range = "—";
  if (data.high30 && data.low30 && data.price) {
    range = (((hi - lo) / data.price) * 100).toFixed(1) + "%";
  }

  const div = data.dividend
    ? `$${data.dividend.cash_amount} ex-div ${data.dividend.ex_dividend_date}`
    : "No recent dividend";

  tickerContext.innerHTML = `
    <strong>${ticker}</strong><br><br>
    Last close: ${price}<br>
    30-day high / low: ${hi} / ${lo}<br>
    30-day range: ${range}<br>
    Dividend: ${div}
  `;
}
