# Git Commit Guidelines

## Commit Message Format

Use the following format for commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **docs**: Documentation only changes
- **chore**: Changes to build process, dependencies, etc.
- **style**: Changes that do not affect the meaning of the code (formatting)
- **ci**: Changes to CI/CD configuration

### Scope
The scope should specify what part of the codebase is affected:

```
budget, transaction, approval, reconciliation, payment, 
dashboard, auth, settings, email, notification, etc.
```

### Subject
- Use imperative mood: "add" not "added" or "adds"
- Do not capitalize first letter
- Do not end with a period
- Maximum 50 characters
- Use English only

### Body (Optional)
- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Use bullet points for multiple changes
- Reference issues: "Fixes #123", "Relates to #456"

### Footer (Optional)
```
BREAKING CHANGE: description of breaking change
Closes #issue-number
Reviewed-by: @username
```

---

## ✅ Good Commit Examples

```
feat(budget): add budget period creation endpoint

- Create POST /api/budgets/periods endpoint
- Add validation for period dates (start < end)
- Return 201 Created with location header
- Add integration tests

Fixes #123
```

```
fix(transaction): resolve calculation error in available budget

The available budget was not accounting for reserved amounts.
This caused overbooking when approvals were pending.

- Subtract reserved_amount in budget calculation
- Add unit tests for encumbrance logic
- Update allocation view to show available amount

Fixes #456
```

```
refactor(approval): simplify approval workflow logic

- Extract approval level checking to separate function
- Reduce cyclomatic complexity from 12 to 6
- Improve testability with dependency injection

Performance improvement: ~15% faster approval processing
```

```
test(cashbook): add reconciliation variance tests

- Test positive variance detection
- Test negative variance detection
- Test reconciliation matching logic
```

```
docs(readme): add deployment instructions

Updated README with:
- Step-by-step Docker deployment guide
- Environment variable setup
- Health check verification
```

---

## ❌ Bad Commit Examples

```
❌ update stuff
❌ fixed bugs
❌ changes to budget and approval modules
❌ ADDED FEATURE
❌ asdfghjkl
❌ fix bug in the budget calculation when the amount is 0 and the user tries to create a new period with conflicting dates
```

---

## Commit Size Guidelines

| Size | Commits |
|------|---------|
| **Tiny** | < 50 lines changed | ✅ Preferred |
| **Small** | 50-200 lines | ✅ Good |
| **Medium** | 200-500 lines | ⚠️ Consider splitting |
| **Large** | 500+ lines | ❌ Split into multiple commits |

---

## Examples by Module

### Budget Module
```
feat(budget): add budget transfer endpoint
feat(budget): implement budget allocation form
fix(budget): correct consolidated budget calculation
test(budget): add budget validation tests
docs(budget): add budget API documentation
```

### Transaction Module
```
feat(transaction): add recurring transaction scheduler
feat(transaction): implement invoice attachment upload
fix(transaction): resolve transaction code generation conflict
perf(transaction): optimize transaction list query with indexing
```

### Approval Module
```
feat(approval): add 3-level approval workflow
feat(approval): implement approval notification emails
fix(approval): prevent approval level bypass
test(approval): add approval chain tests
```

### Reconciliation Module
```
feat(reconciliation): add bank reconciliation tool
feat(reconciliation): implement variance analysis
fix(reconciliation): resolve date range filtering
docs(reconciliation): add reconciliation guide
```

---

## Branch Naming Convention

```
feature/<feature-name>
feature/<feature-name>/<sub-feature>

fix/<bug-name>
hotfix/<critical-bug>

docs/<documentation-update>
refactor/<component-name>
chore/<maintenance-task>
```

### Examples
```
feature/budget-management
feature/budget-management/transfer
feature/transaction-management
feature/transaction-management/recurring

fix/budget-calculation-error
hotfix/critical-approval-bug

docs/api-documentation
refactor/approval-service
chore/update-dependencies
```

---

## Commit Best Practices

### ✅ Do's
- ✅ Write commits for single logical change
- ✅ Test before committing
- ✅ Use descriptive messages
- ✅ Commit frequently (multiple times per day)
- ✅ Reference related issues
- ✅ Keep commits atomic

### ❌ Don'ts
- ❌ Don't commit multiple unrelated changes
- ❌ Don't use vague messages ("fix", "update", "changes")
- ❌ Don't commit debug/console.log code
- ❌ Don't commit uncommitted files
- ❌ Don't force push to shared branches
- ❌ Don't rewrite history after PR review

---

## Interactive Rebase (Before Push)

Before pushing, clean up commits with interactive rebase:

```bash
# Rebase last 5 commits
git rebase -i HEAD~5

# In the editor:
# pick = use commit
# reword = edit commit message
# squash = combine with previous commit
# fixup = like squash, discard message
# drop = remove commit

# Example workflow:
# pick abc1234 feat(budget): add period creation
# squash def5678 fix(budget): correct date validation
# reword ghi9012 feat(budget): add budget form

# Result: 2 clean commits instead of 3
```

---

## Viewing Commit History

```bash
# View commits in current branch
git log --oneline

# View commits with details
git log --pretty=format:"%h - %s (%an)"

# View commits in feature branch not in develop
git log develop..feature/budget-management

# View commits touching specific file
git log --oneline -- apps/backend/src/routes/budget.ts

# View commits by developer
git log --author="developer@company.com"

# View styled log (pretty)
git log --graph --oneline --all
```

---

## Common Scenarios

### Scenario 1: You committed but haven't pushed
```bash
# Amend last commit message
git commit --amend -m "feat(budget): correct message"

# Add forgotten file to last commit
git add .env
git commit --amend --no-edit

# Push with force (only on your feature branch!)
git push origin feature/budget-management --force-with-lease
```

### Scenario 2: You made multiple commits and want to squash
```bash
# Interactive rebase last 3 commits
git rebase -i HEAD~3

# In editor, change "pick" to "squash" for commits 2 & 3
# Save and edit final message
# Force push
git push origin feature/budget-management --force-with-lease
```

### Scenario 3: You committed to wrong branch
```bash
# Save your commits
git stash

# Switch to correct branch
git checkout feature/correct-branch

# Apply commits
git stash pop
git commit
```

