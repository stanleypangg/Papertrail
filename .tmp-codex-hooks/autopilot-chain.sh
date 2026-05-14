#!/bin/bash
# Autopilot phase-chaining Stop hook
# No-op when autopilot is not active (state file doesn't exist)

INPUT=$(cat)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Generate human-readable PROGRESS.md from state.json
_generate_progress() {
  local AP="$1" SF="$2"
  local PLAN=$(jq -r '.plan // "unknown"' "$SF")
  local TOTAL=$(jq '.phases | length' "$SF")
  local DONE=$(jq '[.phases[] | select(.status == "completed")] | length' "$SF")
  local CUR=$(jq -r '.current_phase' "$SF")
  local STEP=$(jq -r '.step' "$SF")
  local STARTED=$(jq -r '.started_at // "unknown"' "$SF")

  {
    echo "# Autopilot Progress"
    echo ""
    echo "Plan: \`$PLAN\`"
    echo "Started: $STARTED"
    echo "Progress: **$DONE / $TOTAL phases**"
    echo "Current: phase $((CUR+1)) — step: $STEP"
    echo ""
    echo "## Phases"
    echo ""
    echo "| # | Phase | Status | PR | Grade | Score |"
    echo "|---|-------|--------|----|-------|-------|"
    local i=0
    while [ $i -lt $TOTAL ]; do
      local NAME=$(jq -r ".phases[$i].name" "$SF")
      local STATUS=$(jq -r ".phases[$i].status" "$SF")
      local PR=$(jq -r ".phases[$i].pr // \"-\"" "$SF")
      local GRADE=$(jq -r ".phases[$i].grade // \"-\"" "$SF")
      local SCORE=$(jq -r ".phases[$i].score // \"-\"" "$SF")
      local MARK=""
      case "$STATUS" in
        completed) MARK="completed" ;;
        pr_created|merged) MARK="in progress" ;;
        pending) MARK="pending" ;;
        *) MARK="$STATUS" ;;
      esac
      echo "| $((i+1)) | $NAME | $MARK | #$PR | $GRADE | $SCORE |"
      i=$((i+1))
    done
    echo ""
    if [ "$STEP" = "done" ]; then
      local COMPLETED=$(jq -r '.completed_at // "unknown"' "$SF")
      echo "**Completed:** $COMPLETED"
    fi
  } > "$AP/PROGRESS.md"
}

# Prevent infinite loops
[ "$STOP_ACTIVE" = "true" ] && exit 0

# Find .autopilot directory by walking up from cwd (like git finds .git)
AP_DIR=""
if [ -n "$CWD" ]; then
  DIR="$CWD"
  while [ "$DIR" != "/" ]; do
    if [ -d "$DIR/.autopilot" ] && [ -f "$DIR/.autopilot/state.json" ]; then
      AP_DIR="$DIR/.autopilot"
      break
    fi
    DIR=$(dirname "$DIR")
  done
fi

# No autopilot active
[ -z "$AP_DIR" ] && exit 0

STATE_FILE="$AP_DIR/state.json"
[ ! -f "$STATE_FILE" ] && exit 0

# Atomic lock using mkdir (truly atomic on all UNIX)
LOCK_DIR="$AP_DIR/.lock.d"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  # Lock exists — check if stale (>300s)
  LOCK_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_DIR" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 300 ]; then
    exit 0
  fi
  # Stale lock — remove pid file first, then rmdir
  rm -f "$LOCK_DIR/pid" 2>/dev/null
  rmdir "$LOCK_DIR" 2>/dev/null
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    exit 0
  fi
fi
echo $$ > "$LOCK_DIR/pid"

# Read state
STEP=$(jq -r '.step' "$STATE_FILE")
PHASE_IDX=$(jq -r '.current_phase' "$STATE_FILE")
TOTAL=$(jq '.phases | length' "$STATE_FILE")
PHASE_NAME=$(jq -r ".phases[$PHASE_IDX].name" "$STATE_FILE")
PR=$(jq -r ".phases[$PHASE_IDX].pr // empty" "$STATE_FILE")
PLAN=$(jq -r '.plan' "$STATE_FILE")
PIPELINE=$(jq -r '.pipeline // "implementation"' "$STATE_FILE")
STRIKES=$(jq -r ".phases[$PHASE_IDX].strikes // 0" "$STATE_FILE")
ISSUES=$(jq -r ".phases[$PHASE_IDX].last_issues // empty" "$STATE_FILE")
PROJECT_PATH=$(jq -r '.project_path // empty' "$STATE_FILE")
# Deploy URLs — supports single string or object with named targets
DEPLOY_URLS=$(jq -r '.deploy_urls // empty' "$STATE_FILE")
if [ -z "$DEPLOY_URLS" ] || [ "$DEPLOY_URLS" = "null" ]; then
  # Fallback to legacy single deploy_url
  DEPLOY_URL=$(jq -r '.deploy_url // empty' "$STATE_FILE")
  HAS_DEPLOY="false"
  [ -n "$DEPLOY_URL" ] && HAS_DEPLOY="true"
else
  HAS_DEPLOY="true"
fi
# Per-phase deploy targets
DEPLOY_TARGETS=$(jq -r ".phases[$PHASE_IDX].deploy_targets // empty" "$STATE_FILE")
# Auto-merge flag — defaults to true for backwards compatibility.
# When false, verify step approves the PR but does NOT merge; pipeline pauses
# (step=blocked, status=approved) so the user merges manually.
AUTO_MERGE=$(jq -r 'if has("auto_merge") then .auto_merge else true end' "$STATE_FILE")

# Blocked — wait for user
[ "$STEP" = "blocked" ] && exit 0
# Already done — nothing to chain
[ "$STEP" = "done" ] && exit 0

# All done — archive to history.json, clean up state.json
if [ "$PHASE_IDX" -ge "$TOTAL" ]; then
  rm -f "$HOME/.codex/autopilot-active"
  # Mark done with timestamp
  jq '.step = "done" | .completed_at = (now | todate)' "$STATE_FILE" > /tmp/ap-state.tmp && mv /tmp/ap-state.tmp "$STATE_FILE"
  # Generate final PROGRESS.md
  _generate_progress "$AP_DIR" "$STATE_FILE"
  # Archive completed state to history.json
  HISTORY_FILE="$AP_DIR/history.json"
  if [ -f "$HISTORY_FILE" ]; then
    jq --slurpfile completed "$STATE_FILE" '. + $completed' "$HISTORY_FILE" > /tmp/ap-history.tmp && mv /tmp/ap-history.tmp "$HISTORY_FILE"
  else
    jq -s '.' "$STATE_FILE" > "$HISTORY_FILE"
  fi
  # Remove state.json so hook stops firing
  rm -f "$STATE_FILE"
  # Clean up launch script
  rm -f "$AP_DIR/.launch.sh"
  osascript -e 'display notification "All phases complete!" with title "Autopilot"' 2>/dev/null
  exit 0
fi

# Update PROGRESS.md on every hook fire
_generate_progress "$AP_DIR" "$STATE_FILE"

# Prepare directories
PROMPTS_DIR="$AP_DIR/prompts"
LOG_DIR="$AP_DIR/logs"
mkdir -p "$PROMPTS_DIR" "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PROMPT_FILE="$PROMPTS_DIR/${PHASE_NAME}-${STEP}-${TIMESTAMP}.md"
LOG_FILE="$LOG_DIR/${PHASE_NAME}-${STEP}-${TIMESTAMP}.log"

# Check for custom pipeline config
PIPELINE_CONFIG="$AP_DIR/pipeline.json"

if [ -f "$PIPELINE_CONFIG" ]; then
  # Custom pipeline
  STEP_CONFIG=$(jq --arg step "$STEP" '.steps_per_phase[] | select(.step == $step)' "$PIPELINE_CONFIG")
  SKILL=$(echo "$STEP_CONFIG" | jq -r '.skill')
  STEP_DESC=$(echo "$STEP_CONFIG" | jq -r '.description // empty')
  PROMPT_TEMPLATE=$(echo "$STEP_CONFIG" | jq -r '.prompt_template // empty')

  cat > "$PROMPT_FILE" << PROMPT
# Autopilot Resume — Phase: $PHASE_NAME ($((PHASE_IDX+1))/$TOTAL)
Pipeline: $PIPELINE

State file: $STATE_FILE
Autopilot dir: $AP_DIR
$([ -n "$PROJECT_PATH" ] && echo "Project path: $PROJECT_PATH")

## Task
Run $SKILL for the "$PHASE_NAME" phase.
$STEP_DESC

$([ -n "$PROMPT_TEMPLATE" ] && echo "$PROMPT_TEMPLATE" | sed "s/{{phase_name}}/$PHASE_NAME/g")

Plan: $PLAN

When this step is complete, update the state file ($STATE_FILE) using jq.
Read the pipeline config at $PIPELINE_CONFIG to determine next step and state updates.

Current strike count: $STRIKES
$([ -n "$ISSUES" ] && echo "## Previous Issues" && echo "$ISSUES")
PROMPT

else
  # Default implementation pipeline — build prompt based on step
  {
    echo "# Autopilot Resume — Phase: $PHASE_NAME ($((PHASE_IDX+1))/$TOTAL)"
    echo ""
    echo "State file: $STATE_FILE"
    echo "Autopilot dir: $AP_DIR"
    [ -n "$PROJECT_PATH" ] && echo "Project path: $PROJECT_PATH"
    echo ""
    echo "## Task"
    echo ""

    if [ "$STEP" = "build" ]; then
      echo "## Git Branch Setup"
      echo ""
      echo "Before starting, create a feature branch for this phase:"
      echo "  git checkout main && git pull origin main"
      echo "  git checkout -b autopilot/$PHASE_NAME"
      echo ""
      echo "All work for this phase happens on the autopilot/$PHASE_NAME branch."
      echo ""
      echo "## Build Docs Directory"
      echo ""
      echo "IMPORTANT: Before running /build, create the phase-specific docs directory:"
      echo "  mkdir -p docs/build/$PHASE_NAME"
      echo ""
      echo "Then tell /build to use docs/build/$PHASE_NAME/ instead of docs/build/ for all stage docs."
      echo "This means: brief.md, plan.md, execute.md, fix.md, verify.md etc. all go in docs/build/$PHASE_NAME/"
      echo "This preserves previous phases' docs instead of overwriting them."
      echo ""
      echo "## Build"
      echo ""
      echo "Run /build for the \"$PHASE_NAME\" phase."
      echo ""
      echo "Plan: $PLAN — read the section relevant to this phase."
      [ -n "$PROJECT_PATH" ] && echo "Working directory: $PROJECT_PATH"
      echo ""
      echo "When build is complete and PR is created (from autopilot/$PHASE_NAME → main), update the state file ($STATE_FILE):"
      echo "- Set phases[$PHASE_IDX].status to \"pr_created\""
      echo "- Set phases[$PHASE_IDX].pr to the PR number"
      echo "- Set phases[$PHASE_IDX].branch to \"autopilot/$PHASE_NAME\""
      echo "- Set step to \"verify\""
    elif [ "$STEP" = "verify" ]; then
      BRANCH=$(jq -r ".phases[$PHASE_IDX].branch // \"autopilot/$PHASE_NAME\"" "$STATE_FILE")
      echo "## PR Review — Verify Phase"
      echo ""
      echo "Review PR #$PR (branch: $BRANCH) with completely fresh eyes."
      echo "You have no context from the build session — this is intentional."
      echo ""
      echo "Current strikes: **$STRIKES / 3**"
      echo ""
      echo "### Steps"
      echo ""
      echo "1. Read the full PR diff: \`gh pr diff $PR\`"
      echo "2. Review for: architecture, code quality, security, correctness, completeness, edge cases"
      echo ""
      echo "---"
      echo ""
      echo "### If NO issues found → Merge"
      echo ""
      echo "The PR is clean. Grade and merge:"
      echo ""
      echo "#### Grading"
      echo ""
      echo "If project has custom criteria at .claude/evaluation-criteria.md, use those instead of the defaults below."
      echo ""
      echo "Grade this phase on each dimension (1-5):"
      echo ""
      echo "**Core (all phases)**"
      echo ""
      echo "| Dimension | What to evaluate |"
      echo "|-----------|-----------------|"
      echo "| **Architecture** | Clean separation, proper patterns, scalable structure |"
      echo "| **Cleanliness** | Readable code, no dead code, consistent naming |"
      echo "| **Efficiency** | No N+1 queries, proper caching, minimal re-renders |"
      echo "| **Security** | Input validation, auth checks, no injection vectors |"
      echo "| **Completeness** | All requirements met, edge cases handled |"

      # Check if this phase has frontend/UI work
      IS_FRONTEND="false"
      if [ -n "$DEPLOY_TARGETS" ] && [ "$DEPLOY_TARGETS" != "null" ]; then
        echo "$DEPLOY_TARGETS" | jq -e '.[] | select(. == "frontend" or . == "dashboard" or . == "web" or . == "app")' > /dev/null 2>&1 && IS_FRONTEND="true"
      fi
      case "$PHASE_NAME" in
        *frontend*|*ui*|*dashboard*|*landing*|*page*|*layout*|*design*|*component*) IS_FRONTEND="true" ;;
      esac
      if [ "$IS_FRONTEND" = "true" ]; then
        echo ""
        echo "**UI/Frontend (this phase has frontend work)**"
        echo ""
        echo "| Dimension | What to evaluate |"
        echo "|-----------|-----------------|"
        echo "| **Quality** | Cohesive design, not just components strung together |"
        echo "| **Originality** | Avoids default AI patterns (purple gradients, generic cards) |"
        echo "| **Craft** | Typography, spacing, color harmony, contrast |"
        echo "| **Responsiveness** | Works on mobile, tablet, desktop |"
        echo "| **UX** | Intuitive flows, proper loading/error/empty states |"
      fi
      echo ""
      echo "Overall grade: **S** (avg >= 4.5), **A** (avg >= 3.5), **B** (avg >= 2.5), **C** (avg < 2.5)"
      echo ""
      if [ "$AUTO_MERGE" = "false" ]; then
        echo "#### Approve (auto_merge disabled — DO NOT merge)"
        echo ""
        echo "**This project has \`auto_merge: false\` in state.json. Do NOT run \`gh pr merge\` or merge the PR yourself.**"
        echo "Leave PR #$PR open and the branch \`$BRANCH\` intact. The user will merge manually."
        echo ""
        echo "1. Post a brief approval comment on the PR (optional): \`gh pr review $PR --approve --body \"Autopilot verify: clean. Grade: <grade>.\"\`"
        echo "2. Update state ($STATE_FILE):"
        echo "   - Set phases[$PHASE_IDX].status to \"approved\""
        echo "   - Set phases[$PHASE_IDX].grade to the letter grade"
        echo "   - Set phases[$PHASE_IDX].score to the average score"
        echo "   - Set step to \"blocked\""
        echo ""
        echo "The pipeline will pause here. After the user merges PR #$PR manually, they should run \`/autopilot resume\` to advance to the next phase."
      else
        echo "#### Merge"
        echo ""
        echo "1. Merge PR #$PR"
        echo "2. Delete branch: \`git branch -d $BRANCH && git push origin --delete $BRANCH\`"
        echo "3. Switch to main: \`git checkout main && git pull\`"
        echo ""
        if [ "$HAS_DEPLOY" = "true" ]; then
          echo "4. Update state ($STATE_FILE):"
          echo "   - Set phases[$PHASE_IDX].status to \"merged\""
          echo "   - Set phases[$PHASE_IDX].grade to the letter grade"
          echo "   - Set phases[$PHASE_IDX].score to the average score"
          echo "   - Set step to \"deploy\""
        else
          echo "4. Update state ($STATE_FILE):"
          echo "   - Set phases[$PHASE_IDX].status to \"completed\""
          echo "   - Set phases[$PHASE_IDX].grade to the letter grade"
          echo "   - Set phases[$PHASE_IDX].score to the average score"
          echo "   - Set current_phase to $((PHASE_IDX+1))"
          echo "   - Set step to \"build\""
          echo ""
          echo "(No deploy URLs configured — skipping post-deploy verification)"
        fi
      fi
      echo ""
      echo "---"
      echo ""
      echo "### If issues found → Fix & Push"
      echo ""
      echo "Do NOT merge. Fix the issues and push to the same PR:"
      echo ""
      echo "1. Fix each issue in the code"
      echo "2. Commit and push to branch \`$BRANCH\` (keeps PR #$PR open)"
      echo "3. Update state ($STATE_FILE):"
      NEXT_STRIKES=$((STRIKES+1))
      echo "   - Set phases[$PHASE_IDX].strikes to $NEXT_STRIKES"
      echo "   - Set phases[$PHASE_IDX].last_issues to a description of what was found and fixed"
      if [ "$NEXT_STRIKES" -ge 3 ]; then
        echo "   - Set step to \"blocked\" (strikes will reach 3 — human review needed)"
        echo ""
        echo "**WARNING: This is strike $NEXT_STRIKES. After fixing and pushing, set step to \"blocked\"."
        echo "The pipeline will stop for human intervention.**"
      else
        echo "   - Keep step as \"verify\" (a new verify session will review your fixes)"
        echo ""
        echo "After this session ends, a new verify session will automatically start to re-review the PR."
      fi
    elif [ "$STEP" = "deploy" ]; then
      echo "## Post-Deploy Verification"
      echo ""
      echo "PR #$PR was merged. Platforms should be auto-deploying."
      echo ""

      # Build the URL list for this phase
      if [ -n "$DEPLOY_TARGETS" ] && [ "$DEPLOY_TARGETS" != "null" ]; then
        echo "### Deploy targets for this phase:"
        echo ""
        for TARGET in $(echo "$DEPLOY_TARGETS" | jq -r '.[]' 2>/dev/null); do
          URL=$(jq -r ".deploy_urls.\"$TARGET\" // empty" "$STATE_FILE")
          [ -n "$URL" ] && echo "- **$TARGET**: $URL"
        done
        echo ""
        echo "Only verify the targets listed above — other services are not affected by this phase."
      elif [ -n "$DEPLOY_URL" ]; then
        echo "### Deploy URL: $DEPLOY_URL"
      else
        echo "### All deploy targets:"
        echo ""
        jq -r '.deploy_urls | to_entries[] | "- **\(.key)**: \(.value)"' "$STATE_FILE" 2>/dev/null
        echo ""
        echo "No per-phase targets specified — verifying all URLs."
      fi
      echo ""
      echo "### Steps"
      echo ""
      echo "1. **Wait for deploy** — check deploy status via GitHub commit checks or platform dashboard"
      echo ""
      echo "2. **Verify each URL is healthy**:"
      echo "   - Page loads correctly"
      echo "   - Run /qa on each URL to verify features from this phase work"
      echo "   - Check for console errors, broken pages, API failures"
      echo ""
      echo "3. **If healthy** — update state ($STATE_FILE):"
      echo "   - Set phases[$PHASE_IDX].status to \"completed\""
      echo "   - Set current_phase to $((PHASE_IDX+1))"
      echo "   - Set step to \"build\""
      echo ""
      echo "4. **If deploy failed or /qa found issues** — update state:"
      echo "   - Set phases[$PHASE_IDX].strikes to the count"
      echo "   - Set step to \"blocked\""
      echo "   - Set phases[$PHASE_IDX].last_issues to a description of what's wrong"
    fi

    if [ -n "$ISSUES" ]; then
      echo ""
      echo "## Previous Issues (from failed attempts)"
      echo "$ISSUES"
    fi
  } > "$PROMPT_FILE"
fi

# Spawn new tmux window using static runner script
RUNNER="$HOME/.codex/hooks/autopilot-runner.sh"
WINDOW_NAME="ap-${PHASE_NAME}-${STEP}-s${STRIKES}"

# Write a tiny launch script to avoid all tmux quoting issues
LAUNCH="$AP_DIR/.launch.sh"
cat > "$LAUNCH" << 'LAUNCHEOF'
#!/bin/bash
source "$HOME/.zprofile" 2>/dev/null
source "$HOME/.zshrc" 2>/dev/null
LAUNCHEOF
cat >> "$LAUNCH" << LAUNCHEOF
cd "$PROJECT_PATH" || exit 1
# Run codex interactively — prompt passed as positional arg
codex --dangerously-bypass-approvals-and-sandbox --cd "$PROJECT_PATH" "\$(cat '$PROMPT_FILE')"
# Remove lock AFTER codex exits
rm -rf "$AP_DIR/.lock.d"
# Chain to next session directly (Stop hook fires while this window is still alive,
# so it can't spawn the next session — we do it here after Codex exits)
echo '{"stop_hook_active": false, "cwd": "'"$PROJECT_PATH"'"}' | bash ~/.codex/hooks/autopilot-chain.sh
LAUNCHEOF
chmod +x "$LAUNCH"

# Check if tmux is running (don't rely on $TMUX — hook env may not have it)
if tmux list-sessions &>/dev/null; then
  # Prevent duplicates — skip if a window with this name already exists
  if tmux list-windows -a -F '#{window_name}' | grep -qx "$WINDOW_NAME"; then
    rm -rf "$LOCK_DIR"
    exit 0
  fi
  tmux new-window -n "$WINDOW_NAME" "$LAUNCH"
else
  nohup bash "$LAUNCH" > /dev/null 2>&1 &
fi

# Notify
osascript -e "display notification \"Phase: $PHASE_NAME ($STEP) started\" with title \"Autopilot\"" 2>/dev/null

exit 0
