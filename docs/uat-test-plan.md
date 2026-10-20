# ICA test plan

A walk through everything the ISSD Bug Tracker does, for the ICAs to try in the **Test** environment before it goes live. It takes about an hour, and works best with two or three people, because some steps hand a ticket from one person to the next.

**How to record results:** for each step, mark **Pass** or **Fail**. For a fail, note what you expected and what happened, and report it as a ticket in the Bug Tracker itself (application: *Bug Tracker*, if it's been added, or the closest match), with a screenshot.

**Roles in the steps:** *ICA* is whoever is testing. *Developer* is one of Max, Bobby, Hue, Shyamal or Michael. *Supervisor* is Ken.

## A. Signing in and finding your way

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| A1 | Open the Test address and sign in with your CTA account | My Work opens with "Good morning/afternoon, <first name>" | |
| A2 | Look at the top bar | CTA logo in the middle, your name and role on the right | |
| A3 | Click the grid icon at the top left | The app launcher lists Overtime, Staff Expense, Training and Vacation Sick Leave; each opens in a new tab | |
| A4 | Type a word from a ticket title in the search bar under the header and press Enter | The ticket list opens, filtered by that word | |
| A5 | Type a ticket number, e.g. `BT-1001`, in the same search bar and press Enter | That ticket opens directly | |

## B. Reporting

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| B1 | **New Ticket** → Defect → pick an application | "Assign to" fills in that application's developer | |
| B2 | Press **Create ticket** with everything empty | Each required field says what's missing; nothing is created | |
| B3 | Fill in a defect: title, *Called in by* (an end user and department), description, steps, expected and actual result, severity; attach a screenshot and a PDF | The ticket opens, shows "BT-xxxx created", and lists both files | |
| B4 | Choose **Unassigned — Ken will triage it** on another new defect | The ticket is **New**. Ken gets a "needs triage" email | |
| B5 | Create an **Enhancement** | No reproduction or severity fields are asked for | |
| B6 | Try attaching a `.exe` or a file over 25 MB | It's refused with a clear message | |

## C. The ticket list

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| C1 | **All Tickets**: click each tab (Open, Unassigned, Assigned to me, Reported by me, Closed, All) | Each shows the matching tickets; the counts on the tabs match | |
| C2 | Filter by Application and Severity together | Only matching tickets; the filters show as chips you can remove one at a time | |
| C3 | Click the **Title** and **Last updated** column headings | The list sorts, and the line above it says how | |
| C4 | Open a ticket, then click **All Tickets** at the top left | You're back on the same filtered, sorted page | |

## D. Working a ticket through

Two or three people, one ticket, in this order.

| # | Who | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- | --- |
| D1 | Supervisor | Open the ticket from B4 (or from **Needs triage** on My Work) → **Triage** → pick a developer, add a note → **Assign** | Status **Assigned**. The developer gets an "assigned to you" email with the note | |
| D2 | Developer | My Work shows the ticket under **Assigned to me** → open it → **Start work** | Status **In Progress** | |
| D3 | Developer | Add a comment, type `@` and pick the ICA from the list | The ICA gets a "mentioned you" email quoting the comment | |
| D4 | Developer | **Ready for Test** → add a note for the tester → **Confirm** | Status **Ready for Test**. The reporter gets a "ready for you to test" email with the note | |
| D5 | ICA | My Work → **Ready for Test** shows the ticket → **Start testing** → **Reopen**, saying what failed | Status **Reopened**. The developer gets a "reopened" email with the reason | |
| D6 | Developer | **Start work** → **Ready for Test** again | Status **Ready for Test** | |
| D7 | ICA | **Mark Verified** | Status **Verified** | |
| D8 | Anyone | **Close** | Status **Closed**, resolution **Fixed** | |
| D9 | Anyone | Look at the **History** tab | Every step above, newest first, with who did it | |

## E. The other paths

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| E1 | On a New ticket: **Triage** → **Move to backlog without assigning** | Status **Triaged**, unassigned | |
| E2 | On an Assigned ticket: **Unassign** | Back to **Triaged** | |
| E3 | **Won't Fix** → resolution **Duplicate** → enter another ticket's number | The other ticket's title appears under the number; after confirming, the ticket shows "Duplicate of BT-xxxx" | |
| E4 | **Won't Fix** without a comment | It asks for a reason | |
| E5 | Reopen a Closed ticket | Status **Reopened**, resolution cleared | |
| E6 | Click the assignee in the Details panel of an In Progress ticket and pick someone else | Assignee changes, status stays **In Progress**, the new developer is emailed | |

## F. Details, comments and files

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| F1 | Pencil next to the title → change it → **Save** | Title updated; History shows the old and new title | |
| F2 | Pencil on **Details** → change priority and due date → **Save** | Both change; "Ticket details updated" | |
| F3 | Open the same ticket in two browser tabs; save a change in one, then a different change in the other | The second tab says "Someone else updated this ticket" and offers **Reload** | |
| F4 | On your own comment: **…** → **Edit**, then **…** → **Delete** | It changes and shows "(edited)", then disappears after you confirm | |
| F5 | On someone else's comment | No **…** menu | |
| F6 | **Add file** on a ticket; then the bin icon on a file you added | It's added, then removed after you confirm. You can't remove other people's files | |
| F7 | Click a file | It downloads | |

## G. My Work and Applications

| # | Do this | Expect | Pass/Fail |
| --- | --- | --- | --- |
| G1 | As an ICA, open My Work | Ready for Test, Reported by me and four matching cards. Each card opens the matching ticket list | |
| G2 | As a developer, open My Work | Your work grouped Reopened → In Progress → Assigned, plus recent team activity | |
| G3 | As Ken, open My Work | Needs triage (oldest first) with Triage and Won't Fix buttons, and each developer's workload | |
| G4 | As Michael (developer and ICA) | A Developer / ICA switch at the top right that remembers your choice | |
| G5 | **Other sections** at the bottom of My Work | Links to the other roles' queues | |
| G6 | **Applications** → **Add application** with a launcher URL | It appears in the list and in the app launcher | |
| G7 | Switch an application off | Its tickets stay, but it's no longer offered on **New Ticket** or in the launcher | |

## H. Emails

| # | Check | Pass/Fail |
| --- | --- | --- |
| H1 | Every email in the steps above arrived from **bugtracker@cta.org**, within a minute | |
| H2 | Each shows the CTA logo, the ticket's details, and a button that opens the right ticket | |
| H3 | Nobody was emailed about something they did themselves | |
