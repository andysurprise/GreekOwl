const btn = document.getElementById("analyzeBtn");
const analysis = document.getElementById("analysis");
let chart;

btn.addEventListener("click", () => {
  const S = parseFloat(spot.value);
  const K = parseFloat(strike.value);
  const T = parseInt(dte.value) / 365;
  const iv = parseFloat(document.getElementById("iv").value);
  const P = parseFloat(premium.value);

  if (!S || !K || !T || !iv || !P) return;

  const r = 0.01;

  const d1 = (Math.log(S / K) + (r + 0.5 * iv ** 2) * T) / (iv * Math.sqrt(T));
  const d2 = d1 - iv * Math.sqrt(T);

  const delta = normCDF(d1);
  const gamma = normPDF(d1) / (S * iv * Math.sqrt(T));
  const theta = -(S * normPDF(d1) * iv) / (2 * Math.sqrt(T)) / 365;

  deltaVal.textContent = delta.toFixed(2);
  gammaVal.textContent = gamma.toFixed(4);
  thetaVal.textContent = theta.toFixed(4);
  assignProb.textContent = `${Math.round(delta * 100)}%`;

  verdict.innerHTML = generateVerdict(delta, T * 365);

  automation.innerHTML = `
    <li>Profit target BTC @ ${(0.3 * P).toFixed(2)} (≈70% profit)</li>
    <li>Risk stop @ ${(0.8 * P).toFixed(2)}</li>
    <li>Risk limit @ ${(1.0 * P).toFixed(2)}–${(1.05 * P).toFixed(2)}</li>
  `;

  renderChart(S, K, iv, T);
  analysis.classList.remove("hidden");
});

function generateVerdict(delta, dte) {
  let notes = [];
  if (dte < 20) notes.push("⚠ Short DTE increases Gamma risk.");
  if (dte > 50) notes.push("⚠ Long DTE slows Theta efficiency.");
  if (delta < 0.3) notes.push("⚠ Delta low: premium may be inefficient.");
  if (delta > 0.4) notes.push("⚠ Delta high: elevated assignment risk.");

  return notes.length
    ? notes.join("<br>")
    : "✓ Trade aligns with covered-call discipline.";
}

function renderChart(S, K, iv, T) {
  const prices = [];
  const deltas = [];
  const gammas = [];

  for (let p = S * 0.85; p <= S * 1.15; p += S * 0.01) {
    const d1 = (Math.log(p / K) + 0.5 * iv ** 2 * T) / (iv * Math.sqrt(T));
    prices.push(p.toFixed(2));
    deltas.push(normCDF(d1));
    gammas.push(normPDF(d1) / (p * iv * Math.sqrt(T)));
  }

  if (chart) chart.destroy();

  chart = new Chart(greeksChart, {
    type: "line",
    data: {
      labels: prices,
      datasets: [
        { label: "Delta", data: deltas, borderWidth: 2 },
        { label: "Gamma", data: gammas, borderWidth: 2 }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: { color: "#9ca3af" } },
        y: { ticks: { color: "#9ca3af" } }
      }
    }
  });
}

function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function normCDF(x) {
  return (1 + erf(x / Math.sqrt(2))) / 2;
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  return sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}
