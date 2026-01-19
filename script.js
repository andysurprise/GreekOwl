// ---------- Utilities ----------
function normCDF(x) {
  return (1 + Math.erf(x / Math.sqrt(2))) / 2;
}

function blackScholesGreeks(S, K, T, r, sigma, isCall) {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const delta = isCall ? normCDF(d1) : normCDF(d1) - 1;
  const gamma = Math.exp(-0.5 * d1 ** 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
  const vega = (S * Math.exp(-0.5 * d1 ** 2) * Math.sqrt(T)) / Math.sqrt(2 * Math.PI);
  const theta = -(
    (S * sigma * Math.exp(-0.5 * d1 ** 2)) /
    (2 * Math.sqrt(2 * Math.PI * T))
  );

  return { delta, gamma, vega, theta };
}

// ---------- DOM ----------
const tickerInput = document.getElementById("tickerInput");
const loadBtn = document.getElementById("loadBtn");
const tableBody = document.querySelector("#optionsTable tbody");
const spotDisplay = document.getElementById("spotDisplay");

let chart;
let spot = 255.53;

// ---------- Build Strike Ladder ----------
function buildTable() {
  tableBody.innerHTML = "";
  const strikes = [];
  for (let k = 200; k <= 310; k += 5) strikes.push(k);

  strikes.forEach(strike => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${strike}</td>
      <td>—</td>
      <td>—</td>
    `;
    row.addEventListener("click", () => selectStrike(row, strike));
    tableBody.appendChild(row);
  });

  // auto-select ATM
  const atmStrike = strikes.reduce((a, b) =>
    Math.abs(b - spot) < Math.abs(a - spot) ? b : a
  );
  const atmRow = [...tableBody.children].find(
    r => Number(r.children[0].textContent) === atmStrike
  );
  selectStrike(atmRow, atmStrike);
}

// ---------- Strike Selection ----------
function selectStrike(row, strike) {
  [...tableBody.children].forEach(r => r.classList.remove("active"));
  row.classList.add("active");
  renderGreeks(strike);
}

// ---------- Chart ----------
function renderGreeks(strike) {
  const T = 30 / 365;
  const r = 0.05;
  const sigma = 0.25;

  const call = blackScholesGreeks(spot, strike, T, r, sigma, true);
  const put = blackScholesGreeks(spot, strike, T, r, sigma, false);

  const data = {
    labels: ["Delta", "Gamma", "Vega", "Theta"],
    datasets: [
      {
        label: "Call",
        data: [call.delta, call.gamma, call.vega, call.theta],
        borderColor: "#4da6ff",
        fill: false
      },
      {
        label: "Put",
        data: [put.delta, put.gamma, put.vega, put.theta],
        borderColor: "#ff6666",
        fill: false
      }
    ]
  };

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("greeksChart"), {
    type: "radar",
    data,
    options: {
      scales: {
        r: {
          grid: { color: "#333" },
          angleLines: { color: "#333" },
          ticks: { color: "#888" }
        }
      },
      plugins: {
        legend: { labels: { color: "#ccc" } }
      }
    }
  });
}

// ---------- Load ----------
loadBtn.addEventListener("click", () => {
  const ticker = tickerInput.value.trim().toUpperCase();
  if (!ticker) return alert("Enter a ticker");
  spotDisplay.textContent = `Spot: $${spot.toFixed(2)}`;
  buildTable();
});
