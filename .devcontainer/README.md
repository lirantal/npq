# Dev container

Run this project in a **consistent Node.js 24 + TypeScript** environment without installing toolchains on your machine. Dependencies install automatically; your repo is the workspace inside the container.

## Why use it?

- **Same stack for everyone** — Node 24, pnpm, and tooling match CI and collaborators.
- **Fast onboarding** — Open the folder in a container; `pnpm install` and local git tweaks run once after create.
- **Host secrets, container dev** — `ANTHROPIC_API_KEY` and `SNYK_TOKEN` are passed from your Mac/Linux session into the container when set locally (see below).
- **Optional CLI workflow** — Use `start.sh` if you prefer a terminal-driven container instead of only the editor.

## What’s here

| File | Role |
|------|------|
| `devcontainer.json` | Image, mounts (e.g. your `~/.gitconfig`), lifecycle commands, env forwarding. |
| `post-create.sh` | Runs once after the container is created — e.g. installs [APM](https://github.com/microsoft/apm) (Agent Package Manager) for agent-related tooling. |
| `start.sh` | Brings the dev container up with the Dev Containers CLI, then opens a shell **inside** the container. |

## Usage

### Editor (recommended)

1. Install the **Dev Containers** extension (VS Code) or use Cursor’s dev container support.
2. **Command Palette** → *Dev Containers: Reopen in Container* (or *Rebuild Container* after config changes).
3. Wait for create/start; the editor attaches when ready. `pnpm run dev` runs on each start when `package.json` exists.

### Terminal only

From the **repository root** on your host:

```bash
bash .devcontainer/start.sh
```

Requires Docker running. Uses `npx @devcontainers/cli` to `up` the workspace, then `exec` into `bash`.

## Environment variables (host → container)

Set these **on your machine** before opening/rebuilding the container so they appear inside:

```bash
export ANTHROPIC_API_KEY=sk-...
export SNYK_TOKEN=...
```

They are wired in `devcontainer.json` under `containerEnv` via `localEnv`.

## Optional customization

- **Agent config on the host** — Uncomment the `mounts` entries in `devcontainer.json` to bind `~/.claude`, `~/.gemini`, or `~/.codex` into the container so coding agents see your existing settings.
- **1Password / other CLIs** — Follow the commented blocks in `devcontainer.json` and `post-create.sh` if you need them; keep the image lean by default.

---

After scaffolding, edit paths and secrets to match your team’s policies; this folder is yours to extend.
