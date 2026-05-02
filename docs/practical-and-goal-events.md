## Goal Events Idea ##
- These events are the target events to track progress from digital big board.
- Only display those events that are on the digital big board that lead to these events.

# Goal Event Presentation #
- User-interface web application with Google Apps Script on demand run script to pull rich text content from digital big board (cell shading, event date future/past).
- Will appropriately select events and applicability based on student-type (Pilot, RPA Pilot, CSO, FTE, ABM) and present an elegant, well-organized chronologically ordered list of events leading to the critical goal event.
- Use prerequisites from the MCG to develop the display shell.
- Include a visual percentage of completion overall.
- Separate tracks where appropriate (Pilot, FTE, CSO/RPA) based on event groupings (the parentheses following the event title).
- Events have been vetted against the MCG, so the digital big board and the MCG event numbers should match 100% now (present a flag in the UI if there is a mismatch or not found).

# Goal Events #
PF8311F - C-12 Performance Practical (CSO/RPA)
PF8332F - Multi-Engine Performance Practical (ABM/FTE/P)
FQ9502S - Sim Flying Qualities Practical Exam (ABM/CSO/RPA)
FQ9511F - T-38 Flying Qualities Practical Exam (P)
FQ9512C - T-38 Flying Qualities Practical Control Room (FTE)
SY7503F - MQ-9 Systems Practical Exam (ABM/CSO/RPA, select FTE/P)
SY7511F - F-16 Systems Practical Exam Flight (P)
SY7512C - F-16 Systems Pracitcal Exam Control Room (FTE)
SY7521O - Space Systems Practical (STC)
TF9102E - Comprehensive Written Exam
TF9111E - Comprehensive Oral Exam

# Features #
- Each event is selectable to expand class details (who completed/when, who is scheduled/when, who isn't scheduled)
- Events complete are color coded to completion and will change the color of follow-on events (opted events)
    - Color coding can get complex, but thinking through it there are a few combinations.
    - Combinations:
        - Event Complete: All students have completed event.
        - Event Partially Complete: Most students (>50%) have completed the event.
        - Event Started: Most students (<50%) have not completed the event or at least one is scheduled to do it in the future.
        - Event Not Started: No students have completed the event.
        - Event Prerequisites Partially Met (opted): Depending on previous event completion status. If anyone has COMPLETED the prerequisite, then the event is opted (for somebody).
        - Event Prerequisites Not Met: Nobody is opted for event.
        - Event Prerequisites Met: Everybody has completed all prerequisites.
- Under each event specifically, if selected, the UI will display each student. When hovering or selecting a student, it will show what they have completed or didn't complete leading to that event (show everything in order in the chain - for example, if the event is PF8311F - C12 Perf Practical and the student is "R. Pope", the system will show if he had completed C-12 Autopilot Flight Control System Flight (CSO/RPA), if he didn't complete it, then it will show that as required, but also show the status of the chain leading to that event. So that means the prerequisites for C-12 A/P Flight Control System Flight which are T-38 Low L/D Flight, Tower Flyby Tower, Data Group LA/Turn Perf data flights 3, and C-12 Intermediate Airborne Test Conduct (FTC)... and if any of thoes events haven't been completed the chain will continue until all prerequisites have been met. But again just for digital big board events, not other non-tracked events).
- By User View: Instead of showing the entire class, it will show completion by student. Students will be selectable at the top of the UI.
- Zoom and Pan Features. It's interactive. Drag and move events around (to help organize...if possible easily).

# Google Apps Script Notes #
- Data are logged in human readable ways. Therefore, rich text formatting and cell formatting MUST be used to interpret data.
    - Dates are either future or completed. If the background is white, it is a future event (however sometimes dates in the past haven't been checked for completion). Treat all as completed, but flag those that are in the past and not validated complete in an "issue log" viewable by click at the top of the UI.
    - Light-Grey boxes are used to validate completion. If something is grey with a date, a scheduler has checked if the event was effective on that date. If a container is light-grey WITHOUT a date, then it can be assumed to be complete (typically used for ground training done enmasse).
    - Dark-grey boxes denote events that aren't required. This isn't the source for tracking requirements. That is denoted by the MCG in the parenthese following the event title (P/RPA/CSO/FTE etc).
- Export entire big board by sheet name. When loading the page, a GAS script endpoint call will use ?call=sheets_avail or something, and return the available sheets to call data from. Assume all sheets are formatted like the 26A FTC Big Board. This will create a dropdown to choose the desired sheet.
- When the desired sheet is selected, user will click a button to start the data pull from GAS from that sheet.
- There are some hidden columns, only ones with names actually filled in (Row 6 prior to column AA), are active students. Below that denotes the student type (CSO/RPA/FTE/ABM/ Pilot-xxx). Pilot is a pilot, the xxx following Pilot just denotes where they came from like bombers, fighters, mobility.
- Next down is their data group (LJ-25, F-16, T-38, or C-12).
- Exception to event completion notations: Some events have colorful coding (all colors not just light/dark grey). Those are for me to identify paired students. For those events, I will use strikethrough rich text to denote completion. So if you see other than white, light or dark grey, and it has a color component to it (RGB), then it is a paired event.

# UI Notes #
- Presentation of UI shall be a simple, white background and bold lines (or as appropriate to display effectively), yet elegant. No dark/gradient backgrounds. Shading of events and UI panels is desired as long as it isn't distracting. Use the UI agent when developing front end things.

## Build Strategy ##
- Agentize the process.
    - Plan, Build, Test, Deploy: Use a singular agent to oversee the planning phase, but 'recruit' agents in the process to advise you. Separate projects using a cohesive method to specific build agents (UI, backend, etc) and ensure they are communicating and working together, don't let them branch too far off. Some independent work is okay, but ensure you see where their work is headed and merge their progress or direct them back together. Do simple tests along the way to reduce technical issues early. When ready, deploy GAS and UI with my help. I will host the GAS on a new deployment and test the HTML locally from my machine before publishing.
- When planning out the process or even when starting to build something, come up with a plan (or sub-plan). Think through the directly stated requirements, understand the overall goal, then derive requirements when appropriate. Always save a record of derived requirements in the project folder.
- Version management. Git versioning is great, but ALWAYS include a new version number prominently at the beginning of the code with a short description and change log in the code itself (comments). Even for minor changes, appropriately change the version.
- Comments. Don't comment on every line, but in sections explain to someone who understands code generically, but may not understand the specific coding language. Keep the code well-organized and clean, yet effective.