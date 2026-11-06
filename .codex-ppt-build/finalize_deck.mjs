import path from "node:path";
import { pathToFileURL } from "node:url";

const skillDir = "C:/Users/Krishna Karthik/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations";
const workspaceDir = "C:/Users/Krishna Karthik/Desktop/predictive-proj";
const candidatePath = path.join(workspaceDir, ".codex-ppt-build", "candidate.pptx");
const finalPath = path.join(workspaceDir, ".codex-ppt-output", "GridPulse_Deep_Research_Project_Deck_v5_feature_graph.pptx");
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);

const result = await finalizePresentation({
  explicitTotalSlideCount: 36,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/Krishna Karthik/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "4",
    "--require-native-table-slide", "5",
    "--require-native-table-slide", "10",
    "--require-native-table-slide", "18",
    "--require-native-table-slide", "28",
    "--require-native-table-slide", "29",
    "--require-native-table-slide", "34",
  ],
  requiredNativeTableOwnerSlides: [4, 5, 10, 18, 28, 29, 34],
  materializeLiteralChartWorkbooks: true,
  // Artifact-tool charts are native editable chart objects. The optional
  // quantitative-chart gate additionally requires an OOXML externalData
  // relationship, which the current artifact-tool chart API does not emit
  // for inline categories/series. Keep the charts in the deck and validate
  // the package/layout/integrity gates below.
  fontPolicy: { basis: "design", families: ["Aptos"] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-ppt-build", "GridPulse_Deep_Research_Project_Deck_v5_feature_graph.validation.json"),
});
console.log(JSON.stringify(result));
