// Safari-safe normal CDF approximation
function normPDF(x) {
  return Math.exp(-0.5 * x*x) / Math.sqrt(2*Math.PI);
}

function normCDF(x) {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const a1=0.31938153, a2=-0.356563782, a3=1.781477937, a4=-1.821255978, a5=1.330274429;
  const poly = a1*k + a2*k*k + a3*k*k*k + a4*k*k*k*k + a5*k*k*k*k*k;
  const approx = 1 - normPDF(x) * poly;
  return x >= 0 ? approx : 1 - approx;
}

function blackScholesGreeks(S,K,T,r,sigma,isCall) {
  const d1=(Math.log(S/K)+(r+0.5*sigma*sigma)*T)/(sigma*Math.sqrt(T));
  const delta = isCall ? normCDF(d1) : normCDF(d1)-1;
  const gamma = normPDF(d1)/(S*sigma*Math.sqrt(T));
  const vega = S*normPDF(d1)*Math.sqrt(T);
  const theta = 0;
  return {delta,gamma,vega,theta};
}

const loadBtn = document.getElementById("loadBtn");
const optionsBody = document.getElementById("optionsBody");
const spotDisplay = document.getElementById("spotDisplay");
let greeksChart;

loadBtn.addEventListener("click", () => {
  const ticker = document.getElementById("tickerInput").value.trim().toUpperCase();
  if (!ticker) {
    alert("Enter a ticker");
    return;
  }

  const spot = 250;  // demo spot
  spotDisplay.textContent = `Spot: $${spot}`;

  // build ladder
  optionsBody.innerHTML = "";
  const strikes = [];
  for (let s=200; s<=300; s+=5) strikes.push(s);

  strikes.forEach(s => {
    const row=document.createElement("tr");
    row.innerHTML = `<td>${s}</td><td>—</td><td>—</td>`;
    row.onclick = () => showGreeks(s);
    optionsBody.appendChild(row);
  });

  const atm = strikes.reduce((a,b) => Math.abs(b-spot) < Math.abs(a-spot)? b:a);
  showGreeks(atm);
});

function showGreeks(strike) {
  // highlight selected row
  [...optionsBody.children].forEach(r => {
    r.classList.toggle("active", Number(r.children[0].textContent)===strike);
  });

  const S = 250, r=0.01, T=30/365, vol=0.25;
  const call=blackScholesGreeks(S,strike,T,r,vol,true);
  const put =blackScholesGreeks(S,strike,T,r,vol,false);

  const data = {
    labels: ["Delta","Gamma","Vega","Theta"],
    datasets: [
      { label:"Call", data:[call.delta,call.gamma,call.vega,call.theta], borderColor:"#4da6ff" },
      { label:"Put",  data:[put.delta ,put.gamma ,put.vega ,put.theta ], borderColor:"#ff6666" }
    ]
  };

  if (greeksChart) greeksChart.destroy();
  greeksChart = new Chart(document.getElementById("greeksChart"), {
    type:"radar",
    data,
    options:{
      plugins:{legend:{labels:{color:"#fff"}}},
      scales:{r:{grid:{color:"#333"},angleLines:{color:"#333"},ticks:{color:"#888"}}}
    }
  });
}
