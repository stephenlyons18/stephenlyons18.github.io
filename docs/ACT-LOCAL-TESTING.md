# Testing GitHub Actions Workflows Locally with `act`

[`act`](https://github.com/nektos/act) runs your GitHub Actions workflows locally using Docker, letting you validate changes before pushing.

---

## Prerequisites

- **Docker** must be running. Install from [docker.com](https://docs.docker.com/get-docker/).
- A shell with `curl` or `brew` available.

---

## 1. Install `act`

### macOS (Homebrew)
```bash
brew install act
```

### Linux
Download a release binary from [github.com/nektos/act/releases](https://github.com/nektos/act/releases), check it
against the release's `checksums.txt`, and put it on your `$PATH` (or in `bin/`, which is git-ignored). Don't pipe an
install script from a branch tip into `sudo bash`.

### Verify
```bash
act --version
```

---

## 2. First-Run Setup

On first run, `act` will ask which Docker image size to use:

| Option      | Image            | Size   | Notes                         |
|-------------|------------------|--------|-------------------------------|
| Micro       | `node:16-buster` | ~200MB | Basic Node — missing many tools |
| Medium      | `catthehacker/ubuntu:act-22.04` | ~500MB | **Recommended** for this repo |
| Large       | `catthehacker/ubuntu:full-22.04` | ~17GB | Full GitHub runner image       |

Choose **Medium** for a good balance of speed and compatibility.

You can lock this choice in `.actrc`:
```
# .actrc  (place in repo root or ~/)
-P ubuntu-latest=catthehacker/ubuntu:act-22.04
```

---

## 3. Secrets File

Workflows that push code (Prettier) or read private repos require a `GITHUB_TOKEN`.

Create a **`.secrets`** file in the repo root (never commit this file):
```
GITHUB_TOKEN=<a fine-grained token, this repo only, read-only unless you test a push>
```

Add to `.gitignore`:
```
.secrets
```

Pass it to `act` with:
```bash
act --secret-file .secrets
```

---

## 4. Running Workflows

### List all available workflows + jobs
```bash
act -l
```

### Run the deploy workflow (dry run only)
```bash
act push -n          # -n / --dryrun: plan the jobs without running any step
```
> **Never run `act push` for real with a token in `.secrets`:** `deploy.yml` pushes `dist/` to the live `build`
> branch (and force-pushes it on rollback). Test the build steps with `pnpm build` instead.

### Run a specific workflow by filename
```bash
act -W .github/workflows/prettier.yml --secret-file .secrets
```

### Run a specific job within a workflow
```bash
act -W .github/workflows/prettier.yml -j prettier --secret-file .secrets
```

### Run CI (the release gate for PRs into `main`)
```bash
act pull_request -W .github/workflows/ci.yml
```
Needs no secrets. It's slow in a container (Chromium + 3 device projects), so locally `pnpm test && pnpm build && pnpm e2e`
from `astro-portfolio/` is the faster check.

### Trigger a `workflow_dispatch` event
```bash
act workflow_dispatch -W .github/workflows/health-check.yml --secret-file .secrets
```

> **Note:** `workflow_run` triggers (used by prettier, trufflehog, health-check) cannot be directly triggered by `act` — use `workflow_dispatch` to simulate them locally.

---

## 5. Workflow-Specific Notes

### `prettier.yml`
Requires write access to push commits back. When testing locally, the `git push` step will fail unless a valid `GITHUB_TOKEN` with `contents: write` is provided. You can skip the push by running with `--dry-run` or by temporarily commenting out the `git push` line.

```bash
act workflow_dispatch -W .github/workflows/prettier.yml --secret-file .secrets
```

### `trufflehog.yml`
The `trufflesecurity/trufflehog` action (SHA-pinned in the workflow) requires Docker-in-Docker capability. Run with the **Large** image or use the `--privileged` flag:

```bash
act workflow_dispatch -W .github/workflows/trufflehog.yml \
  --secret-file .secrets \
  --privileged
```

### `health-check.yml`
Hits live URLs at `https://stephenlyons.dev`. Requires internet access from inside the container (enabled by default in act). Skip the 60-second propagation wait locally by setting the env var:

```bash
act workflow_dispatch -W .github/workflows/health-check.yml \
  --secret-file .secrets \
  --env BASE_URL=https://stephenlyons.dev
```

Or override `BASE_URL` to point at a local dev server:
```bash
act workflow_dispatch -W .github/workflows/health-check.yml \
  --env BASE_URL=http://host.docker.internal:4321
```

---

## 6. Using Podman Instead of Docker

`act` supports any container engine compatible with the Docker Engine API via the
`DOCKER_HOST` environment variable. No Docker daemon is required.

### Enable the Podman socket (Linux, rootless)

```bash
systemctl --user enable --now podman.socket
```

The socket path is usually:
```
/run/user/$(id -u)/podman/podman.sock
```

### Run act with Podman (one-off)

```bash
DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock" act
```

### Run act with Podman (persistent)

**Option A — export in your shell profile (`~/.bashrc` / `~/.zshrc`):**
```bash
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
```
Then just run `act` normally.

**Option B — add to `.actrc` in the repo root:**
```
--container-daemon-socket unix:///run/user/1000/podman/podman.sock
```

### macOS (Podman Desktop / `podman machine`)

```bash
podman machine start
DOCKER_HOST="unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')" act
```

---

## 7. Useful Flags

| Flag | Purpose |
|------|---------|
| `-n` / `--dry-run` | Print steps without executing |
| `--verbose` | Detailed step-by-step output |
| `--privileged` | Needed for Docker-in-Docker actions |
| `--reuse` | Reuse existing containers (faster re-runs) |
| `--rm` | Remove containers after run (default) |
| `-P ubuntu-latest=...` | Override runner image |
| `--env KEY=VALUE` | Inject environment variables |
| `--secret-file FILE` | Load secrets from file |

---

## 8. `.actrc` Reference Config

Create `.actrc` in the repo root to avoid repeating flags:

```
-P ubuntu-latest=catthehacker/ubuntu:act-22.04
--secret-file .secrets
```

---

## References

- [`act` repository](https://github.com/nektos/act)
- [`act` documentation](https://nektosact.com/)
- [catthehacker Docker images](https://github.com/catthehacker/docker_images)
