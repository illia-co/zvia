# Docker Specification

Docker is scoped to the selected server.

If:

    Production

is selected, Docker displays only Docker resources on Production.

Never aggregate Docker data across servers.

---

# Navigation

Docker contains:

    Containers
    Images
    Volumes
    Networks

---

# Containers

List:

- name
- status
- image
- ports
- uptime

Actions:

- start
- stop
- restart
- remove
- inspect
- logs
- terminal

---

# Container Logs

Use:

    docker logs

Support:

- live
- pause
- search
- copy
- timestamps

---

# Container Terminal

Use:

    docker exec -it

Provide an interactive terminal using the same terminal infrastructure.

---

# Images

Display:

- repository
- tag
- image ID
- size
- created

Allow removal with confirmation.

---

# Volumes

Display:

- name
- driver
- mountpoint

Allow inspection and deletion.

Deletion must require confirmation.

---

# Networks

Display:

- name
- driver
- scope
- connected containers

---

# Docker Missing

If Docker cannot be executed:

    Docker unavailable

    Docker is not installed or the current SSH
    user does not have permission to access Docker.

Provide:

    Open Terminal

Do not automatically modify the server.
