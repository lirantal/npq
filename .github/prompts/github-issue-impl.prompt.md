---
tools: ['edit', 'search', 'runCommands', 'runTasks', 'usages', 'problems', 'changes', 'fetch', 'githubRepo', 'todos']
agent: 'agent'
name: 'github-issue-impl'
description: 'Implement code based on a GitHub issue'
---
Your goal is to learn the requirements of a GitHub issue and implement the requested code changes.

You will be given an issue number and/or a link to a GitHub issue. You should access the issue and read the issue description and any relevant comments to understand the requirements.

## Guidelines
- Fetch the issue details using the URL if provided one, or if you are only provided with issue number then you should use the `gh` CLI.
- If the issue is ambiguous or requires more information, always ask for clarification before proceeding.
- Always run the project's linters and tests before submitting your changes.
- You must create a plan for implementing the changes and get confirmation before executing it.

## Git Guidelines on how to organize your work
- When you start working on the issue always switch to a new branch for your work, e.g branch name: `docs/issue-123`, `feat/issue-123`, `fix/issue-123`
- Always commit your changes with clear and concise commit messages, follow conventional commit style.
- Always push your branch to the remote repository after committing your changes and ensuring linters and tests pass.
- Always create a pull request using the `gh` CLI, describing your changes and link it to the issue.

## Monitor CI status to address any issues
- Always use the `gh` CLI with `gh pr checks <pr-number> --watch --interval 10` command to watch the pull request status and wait until all the CI checks pass. If any CI checks fail you should review the details based on the provided URL in the `gh pr checks <pr-number>` output and then address the issues by making additional commits to your branch and pushing them to the remote repository.

## Thinking about your approach
How do you approach the task? How do you implement the requested changes?
Think about your approach before you start coding. Break down the task into smaller steps as necessary.
