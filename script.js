const PROXY_URL = "https://greekowl-proxy.glance-muckier-7k.workers.dev";

const checklistEl = document.getElementById("checklist");
const greekInfoEl = document.getElementById("greekInfo");

document.getElementById("validateBtn").addEventListener("click", validateTrade);

async function validateTrade() {
  checklistEl.innerHTML = "";
  greekInfoEl.innerHTML = "<p>Select a checklist item to see context.</p>";

  const ticker = document.getElementById("ticker").value.trim().toUpperCase();
  const expiration = new Date(document.getElementById("expiration").value);
  const strike = parseFloat(document.getElementById("strike").value);
  const premium = parseFloat(document.getElementById("premium").value);
  const delta = parseFloat(document.getElementById("delta").value);

  if (!ticker || !expiration || !strike || !premium || !delta) {
    alert("Fill in all fields.");
    return;
  }

  const today = new Date();
  const dte = Math.ceil((expiration - today) / (1000 * 60 * 60 * 24));

  const data = await fetch(`${PROXY_URL}/?symbol=${ticker}`).then(r => r.json());

  addChecklistItem(
    dte >= 20 && dte <= 50 ? "pass" : "warn",
    `Time to expiration: ${dte} days`,
    "DTE",
    "Covered calls between 20–50 DTE balance theta decay and assignment risk."
  );

  addChecklistItem(
    delta >= 0.3 && delta <= 0.4 ? "pass" : "warn",
    `Delta: ${delta.toFixed(2)}`,
    "Delta",
    "Delta approximates the probability of expiring in the money. Higher delta increases assignment risk."
  );

  if (data.dividend?.ex_dividend_date) {
    const exDiv = new Date(data.dividend.ex_dividend_date);
    if (exDiv < expiration) {
      addChecklistItem(
        "fail",
        `Dividend before expiration (${data.dividend.ex_dividend_date})`,
        "Dividend Risk",
        "Early assignment risk increases when the call is ITM and remaining extrinsic value is less than the dividend."
      );
    } else {
      addChecklistItem(
        "pass",
        "No dividend before expiration",
        "Dividend Risk",
        "Dividend does not affect assignment risk in this window."
      );
    }
  } else {
    addChecklistItem(
      "warn",
      "Dividend data unavailable",
      "Dividend Risk",
      "Dividend information may be missing. Verify manually if assignment risk matters."
    );
  }

  const targetBuyback = (premium * 0.3).toFixed(2);
  addChecklistItem(
    "pass",
    `70% profit target: Buy-to-close @ ${targetBuyback}`,
    "Profit Automation",
    "Buying back at 30% of premium locks most theta decay and avoids late-stage gamma risk."
  );
}

function addChecklistItem(status, text, title, explanation) {
  const li = document.createElement("li");
  li.className = status;
  li.textContent = text;
  li.onclick = () => {
    greekInfoEl.innerHTML = `
      <h3>${title}</h3>
      <p>${explanation}</p>
    `;
  };
  checklistEl.appendChild(li);
}
