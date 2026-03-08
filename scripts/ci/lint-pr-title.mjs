import fs from "node:fs";

const conventionalTitlePattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?:\s.+$/;

function getTitle() {
  if (process.env.PR_TITLE && process.env.PR_TITLE.trim().length > 0) {
    return process.env.PR_TITLE.trim();
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    return "";
  }

  const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  return payload.pull_request?.title?.trim() ?? "";
}

const title = getTitle();
if (!title) {
  console.error("Unable to resolve PR title from PR_TITLE or GITHUB_EVENT_PATH.");
  process.exit(1);
}

if (!conventionalTitlePattern.test(title)) {
  console.error(`PR title is not Conventional Commit compliant: \"${title}\"`);
  console.error("Expected format: type(scope): subject");
  process.exit(1);
}

console.log(`PR title passed Conventional Commit check: \"${title}\"`);
