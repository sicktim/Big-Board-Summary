# Issue Log — Big Board Curriculum Status Tracker

> Append new issues at the top. Resolved entries stay as a running record.
> Format each entry with the template below. The agent reads this file to
> triage and propose fixes; version bumps in code headers should reference
> the issue date/title.

v0.5.0 — MCG re-extraction rewrite (2026-04-21)
  Schema: switched from embedded v1 MCG graph to the structured v2 handoff
  JSON (`mcg-handoff-2026-04-21/MCG-26A_2026-04-21.json`, copied in place as
  `./mcg-26a.json`). v2 adds: `applicabilityDetail.standardMapping`,
  structured `nameTag`/`nameTagRole`/`nameTagAircraft` per prereq,
  `condition` objects (`forDownstream` / `datagroup`), `seriesInfo` for
  Rule G collapse, and `oneOf` prereq groups.
  Loader: 1.4 MB JSON fetched at boot from `./mcg-26a.json` (was embedded,
  making the HTML hard to edit). Works on GitHub Pages (same-origin) and
  via `python -m http.server` locally; refuses to load over `file://`.
  DAG: entire `buildDag` + `resolveToOnBoardPrereqs` replaced with a
  viewer-aware builder that applies KB Rules A / D / E / G / I + the two
  condition types + oneOf groups. Class view = union of per-student DAGs.
  Single-student view = per-viewer DAG filtered exactly to their chain.
  Audited against KB §13.1 / §13.2 / §13.3 — all three worked examples
  match.
  Rule D/E bugfix: crew-solo / non-crew-solo role is now pilot-only.
  Previously non-pilots were over-pruned at events with mixed-audience
  non-crew-solo tags (e.g., CF 6521E `[ABM,CSO,FTE,P,RPA]` non-crew-solo
  C-12 used to prune every non-pilot; now they take it by nameTag).
  oneOf: renders as a dashed virtual "Any 1 of" node ONLY when multiple
  alternatives survive per-viewer filtering. 1 survivor → direct edge.
  Removed: the 18,406-line embedded MCG script block (index.html dropped
  from 21,450 → 3,040 lines). `build-prereq-graph.cjs` is now obsolete
  for embedding (still useful as a reference if we ever re-extract).

v0.2.0
- Was expecting more of a flow chart of events. I wanted to be able to choose a Goal event and see the pathway backwards from the goal event that drill through the event prerequisites. At each endpoint/midpoint, the event should have an overall percentage of completion and an associated color code (as described for no completion, partial completion, majority completion, 100% complete).
- Events not applicable (not required) shall not be shown for that category of person.
- Off-board events shall not be shown.
- Was also expecting (per my drawn up example), a specific-student-centric view VS the overall class dashboard view.

v0.3.1
- Student View - Change color to be different between COMPLETED (done), and OPTED, or SCHEDULED. Change word from BLOCKED to something else more similar to Not Opted.
- Class View - Default view of each pane is condensed and expandable.
    - Add a hide option ( "(-)" symbol button in top right of container that will minimize those containers to a small enough container to only show the event number "CF 6605S" and the color).
    - Allow names to fill in 2 or 3 columns if there is dead space. For example (snipped image), CF 6605S has space where pilots could be split into 2 columns. `Images/dead-space.png`
    - These features will help declutter the view.
- Event filtering/Person Filtering.
    - For events that an RPA pilot or CSO student wouldn't fly (such as multi-engine performance practical - there is no RPA or CSO in title/applicability), don't display those students under the event.
    - For student-centric views, if an event doesn't apply to them (like the ME Perf Practical above), don't show any events leading to it. Just show, Not Applicable.
    - For class-overall view, under each event show if they are opted for those events somehow. Suggestion would be to Dim (light grey) shade their name so that it is still visible, but it isn't black font color.

v0.3.2
- Include titles, not just course number in default collapsed view.
- Seems to be some errors with line rendering. They sometimes don't follow the container edge after opening and closing.
- Opted light green vs done slightly light green is still too subtle.
- "C RYAN" has scheduled Low L/D on "4/14" but shows Opted (which is partially correct) on his board. It should also show "Scheduled 4/14" in addition to Opted.
    - JSON Snippet
        "row": 86,
        "series": "PF",
        "courseNo": "6000",
        "eventNo": "PF 6121F",
        "eventNoRaw": "PF 6121F",
        "title": "T-38 Low L/D Flight",
        "pilotGate": "All",
        "cells": [
            {
            "col": 2,
            "value": "4/14",
            "bgHex": "FFFFFF",
            "rgbFamily": "white",
            "strikethrough": false
- Just wondering why FQ 9511F doesn't have any prerequisites listed. I see that it only has 1 prerequisite that is isn't a Big Board tracked item (FQ 8210Y T-38 .... oral report). However to get to that oral report, there are Big Board-tracked events that need to happen. Globally this needs addressed. We either need to "skip" those events and proceed directly to the big board events, or somehow include those non-big board events in the display.
    - One option of displaying those events could be to include a small symbol on the line between the event or a node somewhere between the events that you can hover over to show what the event is. Nothing is tracked, it's purely for awareness.
    - Thoughts? What required events are missing from this display with that piece of knowledge?

v0.3.3
- Difficult to follow lines between events. There are so many crossing lines to and from each event and some that loop backwards to events in the same column. Is there some sort of optimized way to minimize line crossing in an algorithm?
    - An idea to consider in conjunction with minimizing line crosses and optimal container location would be to focus on an event (by clicking), and showing only the lines and associated containers that are also a part of that click.
    - See `spaghetti-lines.png`
    - Research algorithms that optimize what we are trying to do. I'm not sure what the title would be called, but you would vary the layout of containers based on their nodes to minimize line crossing, line reversals (back to an earlier or same tier), and line length. I would weight higher weight on fixing reversals, then lower weight on crossing, and then lower weight on line length.
- Skip sheet loading when the page loads. Just load the cache. If needed save the available sheets as cache. Right now it really isn't a feature so i'd be okay with removing it entirely for the time being and just look for the 26A FTC Big Board. We can work on that later. Just have an option to reload the data by doing a GAS script call.
- When hovering over individuals in the class view, hovering over their colored circle, it always shows opted even if they are scheduled, complete, or not scheduled.
    - Refine the hovering feature to see the status of that event for the individuals. If they are scheduled, include the date in that popup.
- Scheduled, not opted. If someone is scheduled, but they aren't opted for an event. Ensure it is flagged appropriately. Include a warning symbol and color to denote this situation. Include it in both student and class view. Consider design choices for displaying in both of them.

v0.4.2
- There are events showing that aren't applicable to the goal event.
    - For example, PF 8332F - Multi-engine performance practical shows incorrectly CF 6403F (which only applies to CSO/RPA), but PF 8332F is only for P/ABM/FTEs.
    - The goal event applicability informs what events should be displayed. Right now it is filtering out those students so that's done, but it still shows the events that only those students fly (like RPA CF events).

JSON v2
I think you still need to put an agent on double checking the JSON work for details within the applicability codes. 

  For example, CF 6540-2F (which is CF 6540F, CF 6541F, and CF 6542F) CF-1-3 (P, crew solo) has applicability of "P, crew solo". The JSON only has "P". That will cause errors later because it looks like it applies to   
  every pilot, not just C-12 pilots. There are others like that example, that I will let you find.                                                                                                                         
            
  In PF 8240-2F, Data Group LA/Turn Perf Data Flights 1-3, the applicability for prerequisites is in the name. I don't know if that was in the schema or not. But I think that would be needed as well since not all       
  event pre-requisites for this ride are applicable. I see you have condition, and "datagroup" but not sure what the condition field buys you in the application.

v0.5.0
- CF 6370F T-38 flight training (ABM/CSO/FTE) showing pilots under this event. JSON doesn't have applicability of pilots so that seems right, but something in DAG is making this event flag as a pilot event. There is one pilot who did a T-38 flight training event, but it was an extra flight. I went through the big board just now and removed that event requirement from pilots and moved it to CF-X (non-MCG event).
    - Bottom line though, the Big Board is not the authority on who should complete an event or not. The MCG is. Ensure the DAG is built to make this happen.
- CF 6681F is missing entirely. It should show only non-F-16 datagroup pilots.
- Prerequisite not met warning. Also show what prerequisite is missing when highlighting.
- UI Feature Request: Highlight event and direct prerequisites. Action: When clicking on an event (not expanding), it will focus on that event and events that directly connect to that event (only earlier events). Defocus other events (either with transparency or something).

v0.5.1
- Data Group LA/TP Data Flight 1: Showing some aren't opted, but when hovering cannot see what they are missing.
    - Most are scheduled, so that should be included.
- I forget what the issue was in CF 6681F - But for now I do see it in Sys Practical.
- The OR block: TF 6251F, SY 7304F, SY 7211S, and SY 7212F connect to the OR block that then connects to SY 7511F systems practical.
    - There should be 2 or blocks (the second is for the control room events). I don't see SY 7222F connected or anywhere on the page.
- PRIORITY: The MCG is the truth source. Any event that is S, C, F, I, or L must be shown on the page (regardless if it is on Big Board). If it isn't on Big Board (but is displayed) put a message that "XX ####X - (event name) - not currently tracked on Big Board". Also list it in the Issues tab (and remove whatever is currently in issues tab...which I think are just my notes here).
- Where it says "Nodes shown: 46 of 47 (1 hidden)" allow clicking to see what are hidden.
- When hovering over a prerequisites not met person "WARN: prereqs not met" with the scheduled date. List what prerequisites are missing.
    - Format:
        "E NOVACK - Sched 4/12
        Missing:
        FQ 7222C - Flying Qualities Blankedy Blank (FTE)
        CF 6969F - F-16 Blankedy Blank (FTE/ABM/CSO)"