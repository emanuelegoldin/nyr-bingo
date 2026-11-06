# Codebase map

A quick way for agents (and people) to find code without searching the whole repo.
Open the one file you need, then read only the source files it points to.

| File | Answers | Source |
|---|---|---|
| `specs.md` | Which files implement spec NN (and which spec sections)? | generated |
| `api.md` | Which route handles `METHOD /api/...`? | generated |
| `files.md` | What does each file in a directory do? | generated |
| `migrations.md` | Which migrations exist, in order? | generated |
| `ARCHITECTURE.md` | How do requests, auth, DB, WebSockets, notifications and i18n fit together? Where should new code go? | hand-written |

## Keeping it current

```sh
python3 scripts/codemap.py          # regenerate the generated files
python3 scripts/codemap.py --check  # exit 1 if they are stale
```

Regenerate whenever files are added, moved or deleted, or a header's purpose or spec reference changes, and commit the result in the same change. Edit `ARCHITECTURE.md` by hand when the wiring changes.

The generator reads each file's leading docblock. The first line is its purpose, and every `NN-name.md` mention (optionally followed by ` - Section Heading`) is a spec reference. A file without a header still shows up, just without a purpose; files with no spec reference appear under "Unmapped files" in `specs.md`.
