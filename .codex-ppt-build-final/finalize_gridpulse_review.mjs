import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-final");
const OUT = path.join(ROOT, ".codex-ppt-output-final");
const SKILL_DIR = "C:\\Users\\Krishna Karthik\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.1025.11240\\skills\\presentations";
const candidatePath = path.join(BUILD, "candidate.pptx");
const finalPath = path.join(OUT, "GridPulse_Complete_Predictive_Prescriptive_Analytics_Review_v3.pptx");
const receiptPath = path.join(BUILD, "GridPulse_Complete_Predictive_Prescriptive_Analytics_Review_v3.validation.json");
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);

const result = await finalizePresentation({
  workspaceDir: ROOT,
  candidatePath,
  finalPath,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  pythonExecutable: "C:\\Users\\Krishna Karthik\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "3",
    "--require-native-table-slide", "12",
    "--require-native-table-slide", "16",
  ],
  explicitTotalSlideCount: 24,
  requiredNativeTableOwnerSlides: [3, 12, 16],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Aptos"] },
  verifyArtifactToolImport: true,
  receiptPath,
});
console.log(JSON.stringify(result, null, 2));

