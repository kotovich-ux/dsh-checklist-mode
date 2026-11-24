# Checklist mode

Strict task execution mode: first a numbered plan, then execution strictly by that plan.

## Usage

Type `/checklist` in the composer — the command appears in the `/` menu (Commands section).

| Input | Result |
|---|---|
| `/checklist` | Turns the mode on. Send the task as a normal message next. |
| `/checklist <task>` | Turns the mode on and sends the task to the agent at once. |
| `/checklist off` | Turns the mode off. |

## What changes in behavior

While the mode is active, a `checklist:policy` section is added to the agent's system prompt:

1. first action — a numbered plan with a completion criterion per step, written to `todo_write`;
2. steps run one at a time, in order, each marked `completed` as soon as it is done;
3. finished steps are not revisited, working parts are not reworked;
4. any choice is asked through `ask_user_question` instead of being guessed;
5. no side tasks or improvements beyond the checklist;
6. short answers, final report as "step → result".

## How the menu row looks

The `/checklist` row is dressed like the built-in commands: an icon (a sheet with two lines —
the first with a checked box, the second with an empty one), a title in the DSH interface language
(it follows Settings → General and switches without a reload), and the English command name.

This is done by the plugin's client half — [`client.js`](../client.js):

- In DSH 2026-11 icons and localized titles exist only for built-in commands — the `HOST_FACES`
  table in `@deepseek-ai/dsh-client-ui-commands/src/client/presentation.ts`; a host command
  descriptor carries only `name`/`description`/`input.hint`. The public `ctx.commandUi` contract
  covers fully client-side commands (contributions — whose name must not collide with a host
  command) and decorations (behavior, no icon).
- Therefore `client.js` wraps `CommandUiRuntime.candidates` — the single place where menu rows
  are assembled — and adds `label`/`description`/`icon` to its own row.
- The wrap is soft: if a future DSH drops the method, a warning is logged, the row loses the
  icon, and the command keeps working.

## Limitations

- The limitation is soft: this is system-prompt text, not a tool ban. A model can deviate, but it
  gets an explicit instruction not to.
- Mode state lives in process memory: after a DSH restart the mode is off and must be enabled
  again.
- The command registers in the Commands section of the `/` menu: the Add section list
  (File, Goal, Plan, Feedback) is hardcoded in the client and unavailable to third-party plugins.
