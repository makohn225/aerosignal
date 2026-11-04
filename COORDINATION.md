# Working on AeroSignal from more than one chat

Two Claude chats and two scheduled tasks change this repository: the long running task chat and the
scheduled tasks push to GitHub themselves, and a regular chat's files are uploaded by Mario through
GitHub. These rules keep them from overwriting each
other's work. Any chat working on AeroSignal should read this file first.

## File numbers

Each chat adds new modules only in its own range, and never reuses a number that already exists in
the repository.

| Who | New module numbers |
|---|---|
| Regular chat (Mario uploads its files through GitHub) | p140 to p149, then p200 to p249 |
| Long running task chat (pushes directly) | p150, p152 to p199, then p250 to p299 |
| Scheduled task "AeroSignal feedback check" | p300 to p349 |
| Scheduled task "AeroSignal competitive upgrade" | p151 (Flight plan sheet), then p350 to p399 |

If a range runs out, take the next free block of 50 above p400 and add it to this table.

The task chat used p157 to p162 on October 28, 2026 and p163 to p166 on November 2, 2026, p167 to p174 on November 3, 2026 (p171 Pilot mode minimums page and tutorial mode swap, p172 scenario practice from accidents, p173 unused, p174 school safety summary, p175 FAA airport status and pilot reports on the brief; p170 moves device data from the old link to the new one; p169 is the Vigilyn name: it renames AeroSignal on screen at runtime, so new text can still say AeroSignal or Vigilyn); p160 loads early, right after p1.

p138 (runway closures) and p139 (October 28 pilot feedback) came from the regular chat. Its p140
(Go to an airport) was never uploaded; the feature was rebuilt as p152, and p140 is unused. The task
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

## Publishing

Vercel is connected to GitHub: every push to main publishes production. Publish only by pushing to
main (or by an upload through GitHub). Never create a Vercel deployment from files directly; the next
push would replace it and the change would be lost.

Before every push, pull (or fetch and rebase on) the latest main and build on it, so a push never
replaces anyone else's work.

## Tests

Before publishing a change to a calculation (distance, course, wind, variation, weight and balance, fuel,
nav log), run node tests/calc.test.cjs from the repository root. Every case must pass.

## Brief panel positions

Never anchor a new brief panel right after a panel another module already anchors to; two modules
that both insist on "right after #advPanel" swap places forever and the page jumps (p92 and p350,
fixed November 2, 2026). Anchor to the last panel in that chain instead, currently
#advPanel > #asPanel > #dayPanel > #nsPanel (p175, November 3), so a new panel goes after #nsPanel.
