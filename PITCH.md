# SideQuest — five-minute demo script

Read this top to bottom. The bold lines are what you say out loud. The bracketed
lines are what you do. Nothing here needs improvising, and none of the three
numbers need memorising — every one of them is on the screen when you say it.

---

## Before you start

- Dev server running, browser on `/today`, sidebar visible.
- Second tab already open on `/plan` so you never wait on a page load.
- Check `/api/health` once — it tells you whether you are on memory or Supabase.
  Either is fine. You just want to know before you are on stage.
- Say the numbers as you read them off the screen. If one differs from this
  script by a point or a day, read the screen. The screen is right.

---

## Problem — 30 seconds

> **Everyone here had a hobby before their calendar filled up.**
>
> **Mine is a guitar I bought in March that has been furniture since May. The
> way that happens is not dramatic. Nobody cancels your hobby. Work just takes
> the good hours, and what is left is 9pm on a Tuesday after six hours of
> meetings — and at 9pm on that Tuesday you do not pick up the guitar.**
>
> **Do that enough times and you stop concluding you were tired. You start
> concluding you are the kind of person who does not stick with things. That is
> the part that does the damage.**

Pause here. Do not rush this beat.

---

## The insight — 30 seconds

> **Every calendar tool schedules into free time. Free time is not the same as
> capable time.**
>
> **Your wearable already knows when you are spent. Your calendar already knows
> when the day was brutal. Nothing joins those two things and then actually
> does something about it.**
>
> **SideQuest does. It is an agent for teams that reads your WHOOP recovery and
> your calendar load, turns both into one capacity score, and only books hobby
> time where you can genuinely show up. The feature I am proudest of is that it
> refuses.**

[Switch to the browser.]

---

## Demo — 3 minutes

### Beat 1 — Today is a wall (about 60 seconds)

[You are on `/today`. Point at the capacity dial.]

> **This is my day. Capacity twenty-four out of a hundred. Depleted.**

[Point at the four factors under the dial, left to right.]

> **And it shows its work, because a number you cannot audit is a number nobody
> trusts. Thirty-one percent recovery. Five point six hours of sleep with
> ninety-five minutes of debt. Six hours of meetings, with one unbroken run over
> four hours long. Day strain fourteen out of twenty-one.**
>
> **Four inputs, four weights, they sum to a hundred. Recovery is weighted
> highest at thirty-eight. Calendar load is twenty-seven and it takes an extra
> penalty specifically for the unbroken run, because three hours of meetings in
> a row does more damage than three hours scattered.**

[Scroll to today's decision card.]

> **So here is what the agent scheduled for tonight. Nothing.**
>
> **Not "no slots found" — there are slots. It found them and turned them down,
> and it tells me why. On a depleted day the budget is zero minutes. That is a
> rule, not a mood.**
>
> **If it had booked me a guitar session tonight, I would have skipped it, and
> I would have felt slightly worse about myself. The refusal is the product.**

### Beat 2 — When you can actually play (about 70 seconds)

[Click **Plan** in the sidebar.]

> **Here is the rest of the week. Every day is scored the same way, so I can see
> where the capacity actually is before I make promises.**

[Point at the proposed blocks.]

> **And here is what it wants to give me instead. Two blocks, later in the week,
> each one with its reasoning attached.**

[Read one block's rationale aloud, off the screen.]

> **It clears a decompression buffer after my last meeting — two hours when I am
> depleted, one when I am steady. It knows evening is when guitar actually
> sticks for me. And it trims the session to fit the day's budget, because a
> short session I finish beats a long one I bail on.**

[Point at the risks on the same card.]

> **It also tells me what could go wrong with its own suggestion. That is
> unusual for a scheduler and it is deliberate — it is trying to earn the right
> to put things on my calendar.**

[Click accept on one block.]

> **There are guardrails under all of this. Two rest days a week minimum. One
> block a day maximum. And the weekly target I set for myself is treated as a
> ceiling it stays under, never a quota it fills. It is trying to under-prescribe.
> That is how the habit survives past week three.**

### Beat 3 — Ethan went quiet (about 50 seconds)

[Go to **Plan**. Scroll to the nudge.]

> **Last piece. This is private, and only I can see it.**
>
> **Ethan has not touched the piano in two weeks. Their streak ended, and
> their calendar has been brutal.**
>
> **The agent did not post that anywhere. It did not rank Ethan against anyone.
> It picked one teammate — me — and asked me to check in, and it showed me the
> signals so I know what I am walking into.**

[Point at the reasons list on the card.]

> **There is no leaderboard in this product anywhere, on purpose. Ranking people
> is the fastest way to make the person who is already struggling quit.**
>
> **Someone underwater does not need to see that four teammates are ahead of
> them. They need one person to ask how it is going. That is the whole idea:
> the agent handles the scheduling, and it hands the human part to a human.**

[Optional, only if you are ahead of time — click **Feed**.]

> **The team feed is here, chronological, proof of progress, no score on it.**

---

## Real versus simulated — 30 seconds

Say this plainly. Judges reward it.

> **Being straight about what is real. The WHOOP telemetry and the calendar are
> both generated — there is no wearable and no calendar account connected today.**
>
> **Everything else is real. The capacity math, the scheduler and its guardrails,
> the streaks, the private nudges, the Postgres persistence — that is all real
> code doing real work, it is just eating synthetic input.**
>
> **And the simulation is confined to exactly two types. A daily signal, shaped
> after the WHOOP daily cycle — recovery, sleep, strain, HRV. And a calendar
> event. Those two types are the adapter boundary. Connecting a real WHOOP
> account means writing one fetcher that returns that shape. Not one line of the
> decision logic changes.**

---

## What is next — 30 seconds

> **Three things, in order.**
>
> **First, the real integrations: WHOOP OAuth and Google Calendar, plus writing
> accepted blocks back to the calendar so they defend themselves against the
> next person who tries to book you.**
>
> **Second, learning from outcomes. Right now the scheduler uses fixed
> guardrails. It should notice that my Thursday blocks get completed and my
> Monday blocks never do, and stop offering Mondays.**
>
> **Third, the thing I actually want to exist: a team that quietly protects each
> other's evenings without anyone having to be the person who says it out loud.**
>
> **SideQuest is an agent that is willing to tell you to do nothing tonight.
> Thank you.**

---

## The three numbers

If you remember nothing else, land these. All three are visible on screen at
the moment you say them.

**1. Capacity 24 out of 100 — depleted.** Four inputs: 31% recovery, 5.6 hours
of sleep with 95 minutes of debt, 6 hours of meetings with an unbroken run over
four hours, day strain 14.2 of 21. Weighted 38 / 20 / 27 / 15, summing to 100.
Result: zero minutes scheduled tonight.

**2. Around five to six hours reclaimed by the team this week.** Real completed
hobby time, not time blocked out. Read the exact figure off the team pulse on
`/team` — it moves with the week.

**3. One private check-in — Ethan, two weeks quiet on piano.** Sent to exactly one
teammate, with the signals attached. Nothing public, nothing ranked.

---

## If something goes sideways

- A page hangs: hit the sidebar link again. Every route is server-rendered and
  independent, so one bad load costs you three seconds, not the demo.
- The agent's wording looks generic: that is the fallback copy, which means the
  model key is absent or the call timed out. Say so and keep going — the numbers
  are identical either way, because the model never produces them.
- You lose your place: go to `/today`. Beats one and three both live there.
