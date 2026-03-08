param(
  [string]$Repo,
  [int]$GitHubActionsAppId = 15368
)

$ErrorActionPreference = "Stop"

if (-not $Repo) {
  $Repo = gh repo view --json nameWithOwner --jq .nameWithOwner
}

if (-not $Repo) {
  throw "Unable to resolve repository. Pass -Repo owner/name explicitly."
}

Write-Host "Applying governance to $Repo"

# Enforce squash-only merges at repository settings level.
gh api --method PATCH "repos/$Repo" `
  -f allow_squash_merge=true `
  -f allow_merge_commit=false `
  -f allow_rebase_merge=false `
  -f delete_branch_on_merge=true | Out-Null

# Patch the tag ruleset with the configured GitHub Actions integration id.
$tagRulesetPath = ".github/rulesets/release-tags-governance.json"
$tagRuleset = Get-Content $tagRulesetPath -Raw | ConvertFrom-Json
$tagRuleset.bypass_actors[0].actor_id = $GitHubActionsAppId
$tagRuleset | ConvertTo-Json -Depth 20 | Set-Content $tagRulesetPath

function Upsert-Ruleset {
  param(
    [string]$FilePath
  )

  $ruleset = Get-Content $FilePath -Raw | ConvertFrom-Json
  $rulesetName = $ruleset.name

  $existingId = gh api "repos/$Repo/rulesets" --jq ".[] | select(.name == \"$rulesetName\") | .id"

  if ([string]::IsNullOrWhiteSpace($existingId)) {
    Write-Host "Creating ruleset: $rulesetName"
    gh api --method POST "repos/$Repo/rulesets" --input $FilePath | Out-Null
  }
  else {
    Write-Host "Updating ruleset: $rulesetName (id=$existingId)"
    gh api --method PUT "repos/$Repo/rulesets/$existingId" --input $FilePath | Out-Null
  }
}

Upsert-Ruleset -FilePath ".github/rulesets/main-governance.json"
Upsert-Ruleset -FilePath $tagRulesetPath

Write-Host "Governance rulesets applied successfully."
