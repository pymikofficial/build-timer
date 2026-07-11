# Build Timer

A zero-dependency CLI that timestamps a build from spec to ship, with pause and resume for real breaks, so every "shipped in Xm" claim on cosmik.work is a measured fact, not a guess.

## The headache

cosmik.work's tagline is "Built, not claimed." Six projects shipped before this tool existed: Automation Priority Sorter, Contract Generator, Fieldnote, Fullshot, Executive Briefing Generator, and Meeting Minutes Extractor. Once the idea came up to show build time on the portfolio as a real differentiator, the honest answer was that three of those six had no timing data at all, nobody had a stopwatch running while they were built. The other two had a real, if informally recorded, elapsed time worth keeping.

The tempting move was to write plausible numbers for the three untimed projects and move on. That's exactly the kind of claim the site's own tagline exists to rule out. So the untimed three got an honest "untracked" badge instead of an invented one, and this tool got built so that from here on, every build-time claim traces back to an actual timestamp.

## The machinery

No dependencies, no hosted service, no accounts. It's a single ESM file (`build-timer.mjs`) that reads and writes a local JSON log (`.build-times.json`, sitting next to the script, gitignored) using nothing but Node's built-in `fs`, `url`, and `path` modules.

Each tracked project is a record with a start timestamp, an optional pause timestamp, a running total of paused milliseconds, and (once finished) an end timestamp and the computed active duration. "Active time" is always wall-clock elapsed time minus total paused time, so a lunch break or an overnight pause doesn't inflate the number. A project can be paused and resumed any number of times before it's finished.

## Commands

```bash
node build-timer.mjs start sop-generator
# Started timer for "sop-generator" at 2026-07-07T08:12:03.000Z

node build-timer.mjs pause sop-generator
# Paused "sop-generator" at 2026-07-07T09:47:11.000Z

node build-timer.mjs resume sop-generator
# Resumed "sop-generator". Total paused time so far: 1h 35m

node build-timer.mjs status sop-generator
# "sop-generator": running, active time so far: 3h 12m

node build-timer.mjs finish sop-generator
# Finished "sop-generator". Active build time: 4h 5m (paused time excluded: 1h 35m)

node build-timer.mjs report
# Project                         Status      Active time
# ------------------------------------------------------------
# sop-generator                   finished    4h 5m
# build-timer                     running     22m

node build-timer.mjs seed executive-briefing-generator 45
# Seeded "executive-briefing-generator" with a manually-known duration of 45m.
```

- **`start <name>`**: begins a new timer. Refuses to clobber an existing unfinished timer for the same name.
- **`pause <name>`**: stops the clock without finishing the build. No-op if already paused or finished.
- **`resume <name>`**: restarts the clock, folding the pause duration into the running total of excluded time.
- **`finish <name>`**: closes out the timer and locks in the active build time (auto-resumes first if it was left paused).
- **`status <name>`**: prints the current state (running/paused/finished) and active time so far, without changing anything.
- **`report`**: lists every tracked project, its state, and its active time, in one table.
- **`seed <name> <minutes>`**: records a manually-known duration directly, for a build that finished before this tool tracked it in real time (used once, for the two builds where the original elapsed time was still known).

Every command is a no-op-safe read of `.build-times.json`, edits are only written when the requested transition is actually valid, so re-running a command against a project in the wrong state just prints a message instead of corrupting the log.

Built by [Soumik Chatterjee](https://cosmik.work).
