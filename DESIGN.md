# Life Board: interaction design notes

Life Board v2 was rebuilt after studying **Structured** (the visual day planner), using its help centre, App Store notes and reviews. These notes cover what Structured does and how each pattern was carried into Life Board, with the exact values used so they can be tuned.

## 1. The timeline is a story, not a grid
**Structured:** a vertical list, not an hourly grid. Each task is a coloured *capsule* holding its icon. The capsule's height grows with its duration, and capsules are threaded together by a line. Free time between tasks is shown as real space with a prompt ("Spare 45m? Plan a breather"). The task in progress shows its own progress and "27m remaining". Completed tasks fill in, strike through and fade.

**Life Board:**
- Capsule height: `40 + duration × 1.05 px`, clamped to 46–176 px, so a 15-minute task and a 2-hour block read differently without the day becoming a scroll marathon.
- Dotted rail behind the capsules. Gaps use a dashed rail with height `gap × 0.55 px`, clamped to 26–96 px.
- Gaps of 10 minutes or more get a rotating prompt. Tapping one opens *New task* prefilled with that start time and up to 60 minutes.
- The live task's capsule fills top-down in its area colour, with "Xm left" in the time line. The "now" dot sits in whichever gap you're in.
- Overlapping tasks are flagged "overlaps" rather than hidden.
- Ticking: the circle fills, the check draws in (stroke animation 280 ms), the capsule fills solid, the title strikes through, and a success haptic plays.
- When the last thing in the day is ticked, the progress ring springs, a small gold burst plays and a toast says the day is complete.
- **Anytime** row at the top for tasks with a day but no time (Structured's all-day row). Overdue undated tasks carry over to today here, marked "from Mon".

## 2. Week strip
**Structured:** a row of dates at the top. Tap a date to jump to it, and swipe the row to change week. Small previews under each date hint at what's planned.

**Life Board:** seven days with up to three area-coloured dots per day, which turn gold when everything that day is done. Today is ringed in red and the selected day is filled ink. Swipe the strip to change week, or swipe the day itself to change day; both play a selection haptic and a 280 ms slide. Tap the month name to jump to any date.

## 3. Creating a task: one sheet, few taps
**Structured:** a large + opens a sheet. The title comes first and an icon is suggested as you type. Then colour, date (defaults to the day you're viewing), duration (defaults 15m, with presets and a slider), and start time on a wheel that steps through times. Typing "6pm for 1h" in the title fills those fields. Subtasks, notes and repeat sit below. A big **Create Task** button is pinned at the bottom.

**Life Board:**
- **Title first, focused, with smart icon:** about 45 keyword rules pick the icon (gym → 🏋️, email → ✉️, lecture → 🎓 …), with the area's icon as fallback. Tap the tile to choose any icon; once you pick one, auto-suggestion stops.
- **Natural language:** "Gym tomorrow at 6pm for 1h", "Read every weekday 9:30pm 20 min", "Lecture 9–11am", "Dentist on the 28th at 10:30am", "Call mum tonight". Each detected part appears as a chip under *Understood*, the wheels spin to match, and the cleaned title shows as "Saves as Gym".
- **Where it goes:** Timeline · Inbox · Goal, as one segmented control, so the same sheet serves all three.
- **Day chips:** the next 8 days plus a date picker.
- **Time wheels:** hour · minute (5-minute steps) · am/pm, drawn as a 3D cylinder (rows rotate by `distance × 20°`, opacity falls `27%` per row).
- **Duration:** quick chips (15m 30m 45m 1h 1h30 2h) plus a horizontal ruler wheel: 5-minute steps to 2h, 15-minute steps to 4h, 30-minute steps to 8h. The live range ("6:30 – 7:30 am") updates as you scroll.
- **Repeat:** Once / Daily / Weekly / Monthly, weekday circles, an "every N" stepper and an optional end date (matching Structured's options).
- **Subtasks and notes:** subtasks show as ☑ 1/3 on the timeline, notes as ✎.
- **Pinned primary button:** its label tells you what will happen: Create task / Create routine / Add to Inbox / Add goal / Save changes.
- **Dismiss:** drag the sheet down by its handle (a haptic tick when you pass the dismiss point), tap outside, or press Escape.

## 4. Wheels and haptics, in detail
**Structured** uses the native iOS picker: the wheel rubber-bands at the ends, flicks carry momentum, and every row that crosses the centre line plays a light "selection" haptic.

**Life Board's `Wheel` (wheel.js)** recreates that by hand:
- Drag 1:1 with the finger. Past the ends it moves at 35% resistance (rubber band).
- On release, velocity from the last ~6 pointer samples is projected forward `260 ms`, then it snaps to the nearest value with an ease-out (160–700 ms, scaled by distance).
- A **haptic tick fires each time a new value crosses the centre**, rate-limited to one every 28 ms so a fast flick still feels distinct.
- Tap any visible row to jump to it. Mouse wheel, trackpad and arrow keys step one value at a time. Each wheel is a screen-reader spinbutton.

**Haptic vocabulary** (`haptic(kind)`):

| kind | when | Android pattern (ms) | iPhone taps |
|---|---|---|---|
| tick | wheel steps, day dots, drag steps | 4 | 1 |
| select | tabs, chips, days | 8 | 1 |
| light | cancel, undo, natural-language match | 10 | 1 |
| medium | + button, pick-up for drag | 16 | 1 |
| heavy | delete | 24 | 2 |
| success | create, tick a task, drop | 10·60·18 | 2 |
| warn | hovering the bin while dragging | 18·50·18 | 2 |

**How it works on each phone**
- **Android (Chrome):** uses the Vibration API, so every kind works, including during momentum.
- **iPhone:** Safari has no vibration API. iOS 18 plays the system selection haptic when a `<input type="checkbox" switch>` is toggled, so Life Board clicks a hidden one. This fires reliably inside touch and click handlers, so you feel ticks while your finger is on the wheel. Ticks during free momentum after you let go may be skipped by iOS. Haptics can be turned off in Settings.

## 5. Inbox
**Structured:** a separate tab for tasks without a time. You can swipe right to complete and left to delete, schedule a task with a + beside it, or drag it onto the timeline.

**Life Board:**
- A quick-add field at the top. Natural language still works there: "Haircut tomorrow at 3pm" goes straight onto the timeline.
- Swipe right for **Done**, left for **Delete**. Past 84 px the colour deepens and a haptic confirms the action will happen if you let go; release before that and the row springs back.
- **Plan** opens the sheet set to Timeline on the day you were viewing, using the task's rough length if it has one.
- Completed tasks fold into a "Done" section with **Clear**.
- The Inbox tab shows a red badge with the number waiting.

## 6. Drag and drop on the timeline
**Structured:** drag a task to a new time, with a preview of where it will land. Dragging onto the + turns it into a red bin, and dropping deletes the task.

**Life Board:**
- **Long-press (360 ms):** the task lifts (scales, casts a shadow, other tasks dim) with a medium haptic.
- **Drag up/down:** every 10 px is 5 minutes. A floating label shows the new range, with a tick haptic per step.
- The **+ button becomes a bin** while dragging. Hovering it turns it red and enlarged with a warning haptic, and dropping deletes with Undo.
- Dropping elsewhere moves the task, with a success haptic and an Undo toast.
- If the task is a routine, you're asked **This one only / This and future ones / Every repeat**, the same three scopes Structured uses.

## 7. Routines (recurring tasks)
Daily, weekly (on chosen weekdays), or monthly, with every-N spacing and an optional end date. A monthly routine that falls on the 31st moves to the last day in shorter months. Editing or deleting asks for the scope:
- **This one only** skips that day and adds a one-off task with your changes.
- **This and future ones** ends the routine the day before and starts a new one from that day.
- **Every repeat** edits the routine itself.

Routines never count as overdue.

## 8. Things deliberately left out
- **Structured AI, calendar import, notifications/alerts:** these need a server or native app permissions. Web push on iPhone needs extra setup and isn't included yet.
- **Energy levels:** worth adding later as an optional field.
- **Focus timer:** not in this version.

## Files
| file | what it does |
|---|---|
| `index.html` | structure: header + week strip, three views, tab bar, sheets |
| `app.css` | ivory diary theme, light and dark, phone first |
| `wheel.js` | `haptic()` and the `Wheel` picker |
| `store.js` | Supabase sign-in, private data, offline outbox, live sync |
| `app.js` | everything else: timeline, inbox, goals, task sheet, gestures |
| `sw.js` | offline app shell (bump `VERSION` on every release) |
