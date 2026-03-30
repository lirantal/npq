#!/bin/bash
set -e

WORKSPACE_FOLDER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting devcontainer for: $WORKSPACE_FOLDER"
npx --yes @devcontainers/cli@0.84.1 up --workspace-folder "$WORKSPACE_FOLDER"

echo "Dropping into container shell..."
npx --yes @devcontainers/cli@0.84.1 exec --workspace-folder "$WORKSPACE_FOLDER" bash