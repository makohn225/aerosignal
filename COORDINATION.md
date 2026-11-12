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

The task chat used p157 to p162 on October 28, 2026 and p163 to p166 on November 2, 2026, p167 to p174 on November 3, 2026 (p171 Pilot mode minimums page and tutorial mode swap, p172 scenario practice from accidents, p173 unused, p174 school safety summary, p175 FAA airport status and pilot reports on the brief, p176 school traffic picture, p177 GPS and approaches check; and p178 clearance practice, p179 three themes with Gold by default and p180 student progress reports p181 Flight Service handoff with Gold and Tactical look fixes p182 Fly screen p183 known issues from FAA Service Difficulty Reports on November 4; p184 avoid special use airspace and p185 magenta line follows route drags on November 5; p186 Maps Route tab and VFR checkpoints p187 compact floating buttons p188 forgiving route entry and p189 3D route preview on November 6; p190 What's new , p191 Your feedback and p192 FAA airport data on November 8 (write feedback.reply when answering testers); p170 moves device data from the old link to the new one; p169 is the Vigilyn name: it renames AeroSignal on screen at runtime, so new text can still say AeroSignal or Vigilyn); p160 loads early, right after p1. On November 9, 2026 it used p193 to p196 (p193 sample brief shortcut, p194 touch polish, p195 route accidents panel, p196 offline terrain and Fly status). On November 10, 2026 it used p197 (map navigation: Full map and Route buttons). On November 11, 2026 it used p198 (demo aircraft picker) and p199 (loading screen: a page is hidden behind a short message until its sections have finished loading; a module that adds a section late will pop in after the reveal, so start its fetch within about a second of the page render).

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
Before any push, node tests/tdz-scan.cjs (needs acorn) checks all modules for names used before they are declared; it must report 0.

## Brief panel positions

Never anchor a new brief panel right after a panel another module already anchors to; two modules
that both insist on "right after #advPanel" swap places forever and the page jumps (p92 and p350,
fixed November 2, 2026). Anchor to the last panel in that chain instead, currently
#advPanel > #asPanel > #dayPanel > #nsPanel (p175) > #gpPanel (p177, November 3) > #kiPanel (p183, November 4) > #fsPanel (p192, November 8) > #rtPanel (p195, November 9), so a new panel goes after #rtPanel.
