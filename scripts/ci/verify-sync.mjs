import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const uvCommand = process.platform === "win32" ? "uv.exe" : "uv";

function printUsage() {
  console.log(`Usage:
  npm run verify:sync
  npm run verify:sync -- --backend-test backend/tests/test_api_integration_flows.py
  npm run verify:sync -- --backend-test backend/tests/test_api_integration_flows.py --backend-test backend/tests/test_case_flows.py
  npm run verify:sync -- --run-e2e --playwright-spec frontend/tests/e2e/executor-flow.spec.ts

Options:
  --backend-test <path>     Add a phase-specific backend pytest target.
  --playwright-spec <path>  Run a specific Playwright spec when paired with --run-e2e.
  --run-e2e                 Execute Playwright after contract/backend/frontend verification.
  --help                    Show this help text.`);
}

function resolveRepoPath(filePath) {
  return path.resolve(repoRoot, filePath);
}

function ensureExists(filePath, label) {
  if (!fs.existsSync(resolveRepoPath(filePath))) {
    console.error(`${label} not found: ${filePath}`);
    process.exit(1);
  }
}

function runStep(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${label}`);
    console.log([command, ...args].join(" "));

    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

const backendTests = [];
let playwrightSpec = null;
let runE2E = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];

  if (arg === "--help") {
    printUsage();
    process.exit(0);
  }

  if (arg === "--backend-test") {
    const testPath = process.argv[index + 1];
    if (!testPath) {
      console.error("--backend-test requires a path.");
      process.exit(1);
    }
    ensureExists(testPath, "Backend test");
    backendTests.push(testPath);
    index += 1;
    continue;
  }

  if (arg === "--playwright-spec") {
    const specPath = process.argv[index + 1];
    if (!specPath) {
      console.error("--playwright-spec requires a path.");
      process.exit(1);
    }
    ensureExists(specPath, "Playwright spec");
    playwrightSpec = specPath;
    index += 1;
    continue;
  }

  if (arg === "--run-e2e") {
    runE2E = true;
    continue;
  }

  console.error(`Unknown argument: ${arg}`);
  printUsage();
  process.exit(1);
}

try {
  await runStep("Contract sync test", uvCommand, [
    "run",
    "--project",
    "backend",
    "pytest",
    "backend/tests/test_contract_sync.py",
  ]);

  if (backendTests.length > 0) {
    await runStep("Phase backend tests", uvCommand, [
      "run",
      "--project",
      "backend",
      "pytest",
      ...backendTests,
    ]);
  } else {
    console.log("\n==> Phase backend tests");
    console.log(
      "Skipped phase-specific backend tests. Pass one or more --backend-test arguments for the slice you changed.",
    );
  }

  await runStep("Frontend typecheck", npmCommand, [
    "--prefix",
    "frontend",
    "run",
    "typecheck",
  ]);

  await runStep("Frontend lint", npmCommand, [
    "--prefix",
    "frontend",
    "run",
    "lint",
  ]);

  if (runE2E) {
    const e2eArgs = ["--prefix", "frontend", "run", "test:e2e"];
    if (playwrightSpec) {
      e2eArgs.push("--", playwrightSpec);
    }
    await runStep("Playwright e2e", npmCommand, e2eArgs);
  } else if (playwrightSpec) {
    console.log("\n==> Playwright e2e");
    console.log(
      `Spec recorded but not executed: ${playwrightSpec}. Re-run with --run-e2e to execute it.`,
    );
  }

  console.log("\nSync verification completed.");
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
