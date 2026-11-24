# dsh-checklist-mode

Strict checklist mode for [DeepSeek Harness](https://www.deepseek.com/en/harness/): a slash
command plus a system-prompt policy that makes the agent plan first, then execute the plan
step by step — without reworking what already works and without inventing choices on its own.

A DSH bundle, not a model: it works with whatever model a user has configured.

## What it does

`/checklist` turns on a mode for the current session. While the mode is on, the agent's system
prompt carries a `checklist:policy` section:

1. **Plan first.** The very first action is a numbered plan written to `todo_write`, each step
   with a completion criterion. The plan is the single source of truth.
2. **One step at a time.** Steps run strictly in order; each one is marked `completed` right
   after it is done.
3. **No rework.** Finished steps are not revisited, working parts are not "improved".
4. **Ask, don't guess.** If a step needs a choice (technology, path, format, trade-off), the
   agent asks with `ask_user_question` and waits.
5. **No side quests.** New items appear only with the user's consent.
6. **Short answers.** Short reports, and a final "step → result" summary.

## Requirements

- DeepSeek Harness `>= 0.2.2-rc.3 < 0.3.0-0` (tested on Desktop 0.2.2-rc.3, Windows).
- The Web UI (Desktop or `dsh web`) — the command and the menu row live there.

## Install

```bash
dsh plugin --profile desktop add dsh-checklist-mode
```

Then restart DSH (or reload the Web UI). In DSH itself you can add the package by name from
**Plugins → Add plugin**.

## Use

Type `/` in the composer and pick **Checklist**, or type the command directly:

| Input | Result |
|---|---|
| `/checklist` | Turns the mode on; send the task as the next message. |
| `/checklist <task>` | Turns the mode on and sends the task at once. |
| `/checklist off` | Turns the mode off. |

The menu row shows an icon (a sheet with two lines: the first has a checked box, the second an
empty one), a title in the DSH interface language (it follows the language picked in
Settings → General and switches without a reload) and the English command name.

## How the menu row is made

DSH 0.2.2 ships icons and localized titles only for its built-in commands; a host command
descriptor carries just `name`, `description` and `input.hint`. The public `ctx.commandUi`
contract covers fully client-side commands and behavioral decorations — neither can dress a
host command row.

So the client half (`client.js`) wraps `CommandUiRuntime.candidates`, the single place where
menu rows are assembled, and adds `label`/`description`/`icon` to its own `checklist` row. The
label comes from a `checklist` locale namespace registered through `ctx.locale`, so it follows the
language selected in DSH rather than the operating system language. The wrap is deliberately soft:
if a future DSH changes or renames that private method, the icon and title simply do not appear
(a warning is logged), and the command keeps working.

If you are upgrading DSH beyond the range above, expect the cosmetic part to need a small
update; `engines.dsh` states the tested range.

## Caveats

- The policy is a prompt-level instruction, not a sandbox: a model can still deviate, it just
  gets an explicit instruction not to.
- Mode state lives in process memory: after a DSH restart the mode is off and `/checklist`
  must be turned on again.
- The plugin registers no HTTP routes, reads no credentials and writes no files.

## Uninstall

```bash
dsh plugin --profile desktop remove dsh-checklist-mode
```

## License

MIT © kotovich-ux
