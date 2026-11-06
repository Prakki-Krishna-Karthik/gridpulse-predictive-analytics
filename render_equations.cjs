const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const { mathjax } = require("mathjax-full/js/mathjax.js");
const { TeX } = require("mathjax-full/js/input/tex.js");
const { SVG } = require("mathjax-full/js/output/svg.js");
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js");
const { AllPackages } = require("mathjax-full/js/input/tex/AllPackages.js");

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
const svgOutput = new SVG({ fontCache: "local" });
const mathDocument = mathjax.document("", { InputJax: tex, OutputJax: svgOutput });

const equations = [
  "\\hat{y}_{i,t+1}=f_\\theta(x_{i,t-23},\\ldots,x_{i,t};G)",
  "a=\\sin^2(\\Delta\\phi/2)+\\cos(\\phi_1)\\cos(\\phi_2)\\sin^2(\\Delta\\lambda/2)",
  "d=2R_e\\arcsin(\\sqrt{a})",
  "R=\\frac{\\rho L}{A}",
  "S=\\frac{|P|}{pf},\\quad I=\\frac{S}{\\sqrt{3}V}",
  "P_{\\mathrm{loss}}=3I^2R",
  "\\hat{y}_{t+1}=y_t",
  "\\hat{y}_{t+1}=\\frac{1}{24}\\sum_{i=0}^{23}y_{t-i}",
  "\\hat{y}_{t+1}=y_{t-24}",
  "z_t=\\sigma(W_zx_t+U_zh_{t-1}+b_z)",
  "r_t=\\sigma(W_rx_t+U_rh_{t-1}+b_r)",
  "\\tilde{h}_t=\\tanh(W_hx_t+U_h(r_t\\odot h_{t-1})+b_h)",
  "h_t=(1-z_t)\\odot h_{t-1}+z_t\\odot\\tilde{h}_t",
  "X^{(0)}=X,\\quad X^{(k)}=PX^{(k-1)}",
  "H=[X^{(0)}\\Vert X_f^{(1)}\\Vert X_f^{(2)}\\Vert X_r^{(1)}\\Vert X_r^{(2)}]W+b",
  "X\\in\\mathbb{R}^{B\\times24\\times12\\times11}",
  "H_t=z_t\\odot H_{t-1}+(1-z_t)\\odot\\tilde{H}_t",
  "\\mathrm{MAE}=\\frac{1}{n}\\sum|\\hat{y}_i-y_i|",
  "\\mathrm{RMSE}=\\sqrt{\\frac{1}{n}\\sum(\\hat{y}_i-y_i)^2}",
  "\\mathrm{MAPE}=\\frac{100}{n}\\sum\\left|\\frac{\\hat{y}_i-y_i}{y_i}\\right|",
  "\\mathrm{Accuracy}=\\frac{TP+TN}{N}",
  "\\mathrm{Precision}=\\frac{TP}{TP+FP},\\quad\\mathrm{Recall}=\\frac{TP}{TP+FN}",
  "F_1=\\frac{2\\,\\mathrm{Precision}\\,\\mathrm{Recall}}{\\mathrm{Precision}+\\mathrm{Recall}}",
  "\\mathrm{moved\\ MW}=\\frac{\\mathrm{current\\ MW}\\times\\mathrm{reroute\\ percentage}}{100}",
  "\\mathrm{headroom}=\\mathrm{proxy\\ capacity}-\\mathrm{current\\ flow}",
  "\\mathrm{route\\ cost}=\\mathrm{distance}\\times(1+2.2\\,\\mathrm{utilization}+6\\,\\mathrm{loss\\ percentage})",
];

const outputDir = path.resolve("report_output", "equations");
fs.mkdirSync(outputDir, { recursive: true });

async function renderEquation(latex) {
  const html = adaptor.outerHTML(mathDocument.convert(latex, { display: true }));
  const start = html.indexOf("<svg");
  const end = html.lastIndexOf("</svg>");
  let svg = start >= 0 && end >= 0 ? html.slice(start, end + 6) : html;
  svg = svg.replace(/currentColor/g, "#000000");
  const hash = crypto.createHash("sha256").update(latex, "utf8").digest("hex").slice(0, 16);
  const output = path.join(outputDir, hash + ".png");
  await sharp(Buffer.from(svg), { density: 300 })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(output);
  console.log(output);
}

(async () => {
  for (const equation of equations) await renderEquation(equation);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
