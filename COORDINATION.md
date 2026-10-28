# Working on AeroSignal from more than one chat

Two Claude chats change this repository: the long running task chat (it pushes to GitHub itself) and
a regular chat (Mario uploads its files through GitHub). These rules keep them from overwriting each
other's work. Any chat working on AeroSignal should read this file first.

## File numbers

Each chat adds new modules only in its own range, and never reuses a number that already exists in
the repository.

| Chat | New module numbers |
|---|---|
| Regular chat (uploads through GitHub) | p140 to p149, then p200 to p249 |
| Long running task chat (pushes directly) | p150 to p199, then p250 to p299 |

p138 (runway closures) and p139 (October 28 pilot feedback) came from the regular chat. The task
chat's round 3 polish, first shipped as p138, now lives in p150.

## Shared files

index.html, README.md, build.mjs, sw.js, vercel.json and .vercelignore are shared.

1. Start from the current version on GitHub (main), never from a copy made earlier.
2. Add your own lines. Do not remove or reorder lines another chat added.
3. In index.html, add each new module's script tag at the end of the list unless it must load early,
   and say why in the module's first comment.

## Before changing an existing module

Pull the latest from GitHub first. If the file changed since you last read it, build on the new
version. Small edits to another chat's module are fine; say what changed in the commit message.

## After an upload

The task chat checks GitHub before each push and merges anything new, so a push from it never
replaces an upload.
