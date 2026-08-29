# File Manager Specification

The File Manager provides Finder-like remote file management over SFTP.

---

# Navigation

Support:

- root
- home
- directories
- breadcrumbs
- back
- forward

Example:

    PRODUCTION /var/www/myapp

---

# Views

MVP:

    List view

Future:

    Icon view
    Columns
    Preview

---

# File Information

Display:

- name
- type
- size
- modified
- permissions where useful

---

# Operations

Support:

- open
- download
- upload
- rename
- move
- copy
- delete
- create directory
- create file

---

# Transfers

Large transfers must provide:

- progress
- speed
- remaining time
- cancel

Example:

    Uploading app.tar.gz

    67%

    412 MB / 612 MB

---

# Editor

Opening a text file should show an editor.

Use:

- syntax highlighting
- line numbers
- search
- save
- save as

The editor must clearly indicate:

    REMOTE FILE

because saving changes the actual server.

---

# Safety

Deleting files requires confirmation.

Never recursively delete without explicit user action.

The terminal remains unrestricted.
