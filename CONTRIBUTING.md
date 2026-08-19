# Contributing to FocusFlow


## Branching Strategy


The `main` branch is the stable branch of the project.


Development work should be performed on a separate branch and merged into `main` through a pull request.


### Branch Naming


Use a prefix that describes the type of change:


- `feature/<name>` — new functionality
- `fix/<name>` — bug fixes
- `perf/<name>` — performance improvements
- `refactor/<name>` — code restructuring without changing behavior


Examples:


```text
feature/llm-evaluation
fix/task-filter
perf/analytics-indexes
refactor/agent-controller
Commit Guidelines

Commits should be small, focused, and describe one logical change.

Use Conventional Commit-style messages:

<type>: <description>

Common types:

feat — new functionality
fix — bug fix
perf — performance improvement
refactor — code restructuring
docs — documentation changes
test — tests or evaluation changes
chore — maintenance changes

Examples:

feat: add LLM evaluation and cost monitoring
perf: add analytics query indexes
perf: optimize server docker image
docs: document deployment strategy

Avoid combining unrelated changes into a single commit.

Pull Requests

Completed work should be merged into main through a pull request.

A pull request should:

Clearly describe what was changed.
Explain the purpose of the change.
Identify relevant tests or verification performed.
Contain only related changes.

Before merging, verify that the project builds and that the relevant functionality works.

Keeping main Stable

Changes should not be committed directly to main during normal feature development.

The expected workflow is:

main
  ↓
Create feature branch
  ↓
Implement one logical change
  ↓
Make focused commit(s)
  ↓
Run verification
  ↓
Open Pull Request
  ↓
Review changes
  ↓
Merge into main

This keeps main stable and makes the development history easier to understand.

Commit History

The Git history should provide a clear record of how the project evolved.

Focused commits and descriptive commit messages should make it possible to understand individual changes using Git history:

git log --oneline --decorate --graph --all

The Git history is the source of truth for project changes; documentation should not duplicate the commit history.