# FocusFlow — Git Workflow

FocusFlow uses a feature-branch and Pull Request workflow to keep `main` stable and maintain a clear development history.

## 1. Branch Structure

`main` is the primary integration branch.

New work is developed on separate feature branches rather than directly on `main`.

Examples from the actual repository:

```text
main
feature/engineering-rubric
feature/multi-step-agent-docker
feat/cost-monitoring-and-robust-showcase
````

A typical workflow is:

```bash
git checkout main
git pull origin main
git checkout -b feature/<feature-name>
```

The feature is developed and tested on the feature branch before being merged into `main`.

---

## 2. Atomic Commits

Changes are divided into small, logical commits rather than one large commit.

For example, the `feature/engineering-rubric` branch contains:

```text
91deede feat: add request body validation middleware with 4 schemas
f22abe9 feat: add controlled tool calling with TOOL_REGISTRY whitelist
7139298 test: add unit tests for closure, planner and agent tools
a97b722 test: add supertest integration tests for auth and task routes
034b763 perf: add MongoDB indexes to FocusSession schema
2ed7f14 chore: configure project test scripts
8fd0289 docs: update PRD, HLD, LLD with five new rubric topics
```

Each commit represents one logical change.

For example, testing is kept separate from the feature implementation:

```text
feat: add controlled tool calling with TOOL_REGISTRY whitelist
test: add unit tests for closure, planner and agent tools
```

This makes the history easier to understand, debug, and revert.

---

## 3. Descriptive Commit Messages

The project uses concise conventional-style commit messages.

Examples:

```text
feat: add controlled tool calling with TOOL_REGISTRY whitelist
test: add supertest integration tests for auth and task routes
perf: add MongoDB indexes to FocusSession schema
docs: add pull request template
```

The message describes the actual change instead of using vague messages such as:

```text
changes
updated stuff
final
```

This allows the purpose of a commit to be understood directly from `git log`.

---

## 4. Pull Request Workflow

Once a feature branch is complete, it is pushed to GitHub and a Pull Request is opened against `main`.

```bash
git push -u origin feature/<feature-name>
```

The repository contains a Pull Request template:

```text
.github/pull_request_template.md
```

The Pull Request provides the change description, implementation scope, tests performed, and documentation changes.

After review and verification, the feature branch is merged into `main`.

The actual repository contains Pull Request merge commits:

```text
3192d90 Merge pull request #4 from Thrizzio/feature/engineering-rubric
1446177 Merge pull request #3 from Thrizzio/feat/cost-monitoring-and-robust-showcase
3175836 Merge pull request #2 from Thrizzio/feature/multi-step-agent-docker
4b5cdd5 Merge pull request #1 from Thrizzio/feature/multi-step-agent-docker
```

This provides direct evidence that feature branches were integrated through Pull Requests rather than simply being copied into `main`.

---

## 5. Maintaining a Clean History

Before committing, changes are inspected with:

```bash
git status
git diff
```

Only files belonging to the current logical change are staged and committed.

The history can then be inspected with:

```bash
git log --oneline --graph --decorate --all
```

For example, the repository history shows individual implementation, testing, performance, and documentation commits rather than one large commit containing everything.

The engineering-rubric branch demonstrates this clearly:

```text
feature branch
      ↓
feature commits
      ↓
test commits
      ↓
documentation commit
      ↓
Pull Request
      ↓
merge into main
```

This gives the project a traceable history while keeping each change understandable.

---

## 6. Repository Evidence

The Git workflow can be demonstrated directly using:

```bash
git branch -a
git log --oneline --graph --decorate --all
git log --merges --oneline --all
```

The repository therefore provides evidence for:

* separate feature branches;
* atomic commits;
* descriptive commit messages;
* testing and documentation commits;
* Pull Request integration;
* merge history into `main`.

The Git history is the source of truth for what was actually implemented and merged.

```
