#!/bin/bash
# Static runner script for autopilot sessions
# Called by autopilot-chain.sh via tmux
# Args: $1=project_path $2=prompt_file $3=log_file

PROJECT_PATH="$1"
PROMPT_FILE="$2"
LOG_FILE="$3"

cd "$PROJECT_PATH" || exit 1
PROMPT=$(cat "$PROMPT_FILE")
codex exec --dangerously-bypass-approvals-and-sandbox --cd "$PROJECT_PATH" "$PROMPT" 2>&1 | tee "$LOG_FILE"
echo ""
echo "=== Session ended. Press enter to close. ==="
read
