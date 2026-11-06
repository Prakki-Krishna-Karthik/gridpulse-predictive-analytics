import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "C:\\Users\\Krishna Karthik\\Desktop\\predictive-proj";
const BUILD = path.join(ROOT, ".codex-ppt-build-review3");
const OUT = path.join(ROOT, ".codex-ppt-output-review3");
const SKILL_DIR = "C:\\Users\\Krishna Karthik\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.1104.12130\\skills\\presentations";
const candidatePath = path.join(BUILD, "candidate.pptx");
const finalPath = path.join(OUT, "GridPulse_Review_3_Graph_Routing.pptx");
const receiptPath = path.join(BUILD, "GridPulse_Review_3_Graph_Routing.validation.json");
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
  ],
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Arial"] },
  verifyArtifactToolImport: true,
  receiptPath,
});
console.log(JSON.stringify(result, null, 2));
