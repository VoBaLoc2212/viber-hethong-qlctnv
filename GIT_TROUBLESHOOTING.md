# Common Git Issues & Solutions

## 🚨 Emergency Git Scenarios

### Problem: You made commits to wrong branch

```bash
# ❌ Oh no! I committed to main instead of feature/budget

# Solution 1: Move commits to correct branch
git log --oneline main   # Note commit hashes

# Reset main to before your commits
git checkout main
git reset --hard origin/main

# Go to correct branch
git checkout -b feature/budget-management origin/develop

# Cherry-pick your commits
git cherry-pick hash1
git cherry-pick hash2
git push origin feature/budget-management
```

---

### Problem: You accidentally committed sensitive data

```bash
# ❌ Oh no! I pushed my .env file with API keys

# Solution: Remove from history immediately
git filter-branch --tree-filter 'rm -f .env' HEAD

# Force push (DANGEROUS! Only do this before PR review)
git push origin feature/budget-management --force-with-lease

# In real scenario: contact team lead immediately!
# Regenerate all exposed API keys/credentials
```

---

### Problem: You have merge conflicts

```bash
# ❌ Conflict when merging develop into your feature branch

# See conflicts
git status
git diff

# Open conflicted file and look for:
# <<<<<<<< HEAD     (your changes)
# ========
# >>>>>>>> develop (their changes)

# Edit file to resolve conflicts

# Mark as resolved
git add resolved-file.ts

# Continue merge
git commit -m "merge: resolve conflicts with develop"
git push origin feature/budget-management
```

---

### Problem: You need to undo the last commit

```bash
# ❌ I made a bad commit and pushed it

# Option 1: Soft reset (keep changes, undo commit)
git reset --soft HEAD~1
# Your changes are back in staging area
git add . && git commit -m "feat: correct message"
git push --force-with-lease

# Option 2: Hard reset (lose changes completely!)
git reset --hard HEAD~1
git push --force-with-lease

# Option 3: Revert (create new commit that undoes it)
git revert HEAD
# This is safer for shared branches
```

---

### Problem: You lost commits (dropped during rebase)

```bash
# ❌ I did interactive rebase and accidentally deleted commits

# View all recent actions
git reflog

# Find your commits
# b6e0e00 HEAD@{1}: commit: feat(budget): add feature

# Recover the branch
git reset --hard b6e0e00

# Or cherry-pick specific commits
git cherry-pick abc1234
```

---

### Problem: Your branch is way behind develop

```bash
# ❌ My feature branch has diverged a lot from develop

# Fetch latest
git fetch origin

# Option 1: Rebase (cleaner history)
git rebase origin/develop feature/budget-management

# If conflicts occur:
# 1. Resolve conflicts in editor
# 2. git add resolved-files
# 3. git rebase --continue

# Option 2: Merge (preserves history)
git merge origin/develop
# Resolve conflicts if any

git push origin feature/budget-management
```

---

### Problem: You need to undo a pushed commit on a shared branch

```bash
# ❌ I pushed a bad commit to develop branch

# Method 1: Revert (PREFERRED for shared branches)
git revert HEAD
# Creates a new commit that undoes the changes
git push origin develop

# Method 2: Reset & Force Push (ONLY if no one else pulled)
git reset --hard HEAD~1
git push --force-with-lease origin develop

# NEVER force push to main or develop without approval!
```

---

### Problem: Accidental force push to shared branch

```bash
# ❌ I force pushed and lost other people's commits!

# EMERGENCY! Contact team immediately!

# If not too late, check reflog
git reflog

# See what was lost
git log origin/develop

# Recover:
git reset --hard origin/develop@{1}
git push origin develop
```

---

## ✅ Git Command Reference by Scenario

### Starting New Feature

```bash
# Get latest changes
git fetch origin

# Create feature branch
git checkout -b feature/budget-management origin/develop

# Verify you're on the right branch
git branch -v
# * feature/budget-management origin/develop
```

### Making Changes

```bash
# See what changed
git status

# Stage files
git add apps/backend/src/routes/budget.ts
git add .  # stage all

# Unstage if needed
git restore --staged file.ts

# See staged changes
git diff --staged

# Commit
git commit -m "feat(budget): add endpoint"

# Amend last commit (before pushing)
git commit --amend -m "feat(budget): corrected message"
```

### Pushing & Creating PR

```bash
# Push to GitHub
git push -u origin feature/budget-management
# (-u sets upstream tracking)

# Or if already set:
git push

# Push with force (ONLY on your feature branch!)
git push --force-with-lease

# Push with specific branch
git push origin feature/budget-management
```

### Syncing with develop

```bash
# Fetch latest
git fetch origin

# See what's new
git log origin/develop..HEAD

# Pull latest develop locally
git fetch origin develop:develop

# Rebase your changes on latest develop
git rebase origin/develop

# Or merge
git merge origin/develop

# View differences
git log --graph --oneline --all
git log develop..HEAD  # commits in HEAD not in develop
```

### Viewing History

```bash
# View commits
git log --oneline                      # short format
git log --oneline -10                  # last 10 commits
git log --pretty=format:"%h - %s"      # custom format
git log -p                             # with full diffs
git log -p -- file.ts                  # for specific file
git log --author="dev1"                # by author
git log --since="2 weeks ago"          # time range

# View branches
git branch -v                          # local branches with tracking
git branch -r                          # remote branches
git branch -a                          # all branches

# View remotes
git remote -v                          # with URLs
```

### Cleaning Up

```bash
# Delete local branch
git branch -d feature/budget-management

# Delete remote branch
git push origin --delete feature/budget-management

# Clean up stale remote branches
git fetch --prune
git branch -r                # verify they're gone

# Remove untracked files (careful!)
git clean -fd               # -f=force, -d=directories

# Unstage everything
git reset

# Discard all changes (CAREFUL!)
git reset --hard HEAD
```

---

## 🔍 Debugging Git Issues

### "fatal: refusing to merge unrelated histories"

```bash
# This happens when branches have no common ancestor

# Solution: Allow unrelated histories
git merge --allow-unrelated-histories origin/develop

# Or during pull
git pull --allow-unrelated-histories
```

### "Your branch has diverged"

```bash
# You and remote made different changes

# See the divergence
git log --oneline --all --graph
git log --oneline origin/develop..HEAD      # local commits
git log --oneline HEAD..origin/develop      # remote commits

# Solution 1: Rebase (recommended)
git rebase origin/develop

# Solution 2: Merge
git merge origin/develop
```

### "Everything up-to-date" but changes not visible

```bash
# Remote might not have pushed yet

# Check status
git status
git log -n 5                    # verify commits exist locally

# Make sure remote is updated
git push origin feature/budget-management

# Verify on GitHub that branch exists and has commits
```

### "Permission denied (publickey)"

```bash
# SSH key issue

# Check SSH agent
ssh -T git@github.com

# If no key:
ssh-keygen -t ed25519 -C "your@email.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub
# Settings → SSH and GPG keys → New SSH key
# Paste contents of ~/.ssh/id_ed25519.pub
```

### "Detached HEAD state"

```bash
# You're on a commit, not a branch

# View current state
git status
# HEAD detached at abc1234

# Create branch from current position
git branch feature/budget-management
git checkout feature/budget-management

# Or go back to develop
git checkout develop
```

---

## 📊 Useful Git Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    unstage = restore --staged
    last = log -1 HEAD
    visual = log --graph --oneline --all
    sync = pull --rebase
    clean-branches = branch -vv | grep "gone]" | awk '{print $1}' | xargs git branch -d
    recent = branch --sort=-committerdate --format="%(refname:short) - %(authorname)"
```

### Usage:
```bash
git st              # instead of git status
git co feature/     # instead of git checkout feature/...
git br -v           # instead of git branch -v
git sync            # pull with rebase
git visual          # pretty log view
```

---

## 🛡️ Git Best Practices Checklist

Before pushing:
- [ ] Verify you're on the correct branch (`git branch`)
- [ ] Check what you're about to push (`git log origin/develop..HEAD`)
- [ ] Make sure tests pass locally (`npm run test`)
- [ ] Make sure build works (`npm run build`)
- [ ] Don't have any uncommitted changes unless intentional

Before force-pushing:
- [ ] ⚠️ Make absolutely sure you're on your feature branch
- [ ] ⚠️ Use `--force-with-lease` not `--force`
- [ ] ⚠️ Only do this before PR review (ideally never)

When pushing to shared branches (main, develop):
- [ ] ✅ Always use merge commits (no rebase)
- [ ] ✅ Use PRs (no direct push)
- [ ] ✅ Wait for approval and CI/CD checks

---

## 🆘 When to Ask for Help

Contact your team lead or senior developer if:
- You have a detached HEAD
- You accidentally force pushed to develop/main
- You have recursive merge conflicts
- You lost commits with reflog
- You're stuck in rebase hell
- Permission issues with GitHub
- Branch protection prevents merging

**Don't panic!** Git is very hard to break permanently. Most issues can be recovered.

