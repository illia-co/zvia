# Git Specification

Git is scoped to the selected server.

If:

    Production

is selected, Git displays only repositories on Production.

Never aggregate Git data across servers.

---

# Navigation

Git contains:

    Repositories

---

# Repositories

List (auto-scan of `~`, `/opt`, `/srv`, `/var/www`, `/home` plus manually added paths):

- name
- path
- branch
- changes (staged / unstaged / untracked counts)
- sync (ahead / behind upstream)

Row actions:

- fetch (`git fetch --prune`)
- pull (`git pull --ff-only` by default)
- push
- open (detail view)
- files (cross-link to the Files tool)

Detail tabs:

- status: branch, upstream, ahead/behind, staged, unstaged, untracked, stash list, branch switch
- history: SVG lane graph (computed from commit parents) beside the commit list (hash, subject, decorations, author, date)
- branches: branch list with upstream, switch, create; remote list

Detail actions:

- pull (rebase variant), force push (confirm dialog, `--force-with-lease`)
- stash push (optional message), pop, apply, drop (confirm dialog)
- create branch, switch branch (blocked with guidance when the work tree is dirty)

---

# Authentication

Git operations run on the server with the server's own SSH keys or agent.
The renderer never sees credentials.

When the remote rejects authentication, actions fail with a short error plus
guidance: generate a key on the server (`ssh-keygen -t ed25519`), add the
public key to the git host, verify with `ssh -T git@<host>` in Terminal.

---

# Pull conflicts

Pull defaults to `--ff-only`. When the branches diverged or conflicts occur,
the error carries formatted hints: which files conflicted (what and where),
whether uncommitted changes block the pull, and the Terminal commands to
resolve (`git status`, `git stash push`, `git pull --rebase`, `git rebase
--continue`).
