# UI/UX Revamp Brief

Last updated: 2026-03-22
Product: Varasaan
Scope: Web app redesign brief for public, planning-mode, and after-loss executor workflows

## 1. What The Product Is

Varasaan is an India-first digital bereavement platform.

Its core job is to help:

- a living user prepare their digital estate while alive
- an executor or family member close, recover, and document digital accounts after death

It is not a password manager, not a credential vault, not an auto-login tool, and not an online will product.

The product promise is:

- help families understand what digital accounts exist
- help them gather the right documents
- help them perform platform-by-platform closure or recovery legally
- help them stop recurring billing
- help them keep proof of what was done

The product should feel like a calm legal-operations workspace built for grief, not a generic productivity SaaS or a cybersecurity dashboard.

## 2. Problem Statement

When someone dies, their family is forced into two crises at once:

- emotional overload
- administrative chaos

Specific problems the product addresses:

- families do not know which digital accounts exist
- subscriptions keep charging after death
- access to email, telecom, finance, and platform accounts is blocked
- legal requests are confusing and platform-specific
- important documents are scattered
- there is no clean audit trail of what has been submitted, resolved, or escalated

## 3. Product Modes

### Planning Mode

Who it is for:

- the account owner while alive

What it does:

- builds a digital account inventory
- marks high-priority accounts
- flags recurring payments
- assigns trusted contacts and executors
- stores and scans important documents
- configures heartbeat reminders

Primary emotional tone:

- reassuring
- proactive
- private
- structured

### After-Loss Mode

Who it is for:

- executor
- family member handling closure

What it does:

- activates a case after death certificate upload
- generates a task workspace from the owner inventory snapshot
- tracks task progress across accounts
- captures evidence and proof files
- stops recurring payments
- generates a printable closure report

Primary emotional tone:

- calm under pressure
- trustworthy
- explicit
- operational

## 4. Core Product Principles To Reflect In UI

- Never imply that Varasaan stores or uses credentials.
- Always show that actions are legal, guided, and document-based.
- Privacy and security should feel foundational, not decorative.
- Executor workflows must reduce cognitive load and ambiguity.
- Print and PDF output are first-class experiences, not side effects.
- India-specific financial and legal realities should be visible in content and examples.

## 5. Current Product Reality

Design only around what exists today unless you are explicitly designing future-state concepts.

### Shipped

- public landing page
- login, register, recovery
- planning dashboard overview
- inventory accounts
- trusted contacts
- document uploads, scans, downloads, grants
- heartbeat reminders and check-in
- packet jobs
- export jobs
- basic payment checkout status flow
- executor case landing
- death-certificate activation flow
- manual review pending and rejected states
- executor task workspace
- task evidence uploads and downloads
- subscription bleed-stopper
- printable closure report
- case close flow

### Not Fully Shipped Yet

- proper tiered billing UX and entitlement-aware navigation
- multi-participant family collaboration
- comments and assignment
- quick-wins account section
- crypto inheritance flows
- polished customer-facing packet generation experience

## 6. Current Visual Assessment

The current UI is functional but visually misaligned with the product purpose.

Current visual traits:

- dark background
- glassmorphism panels
- blue-indigo gradients
- generic security-SaaS tone
- utility-first page composition

Current issues:

- too much "secure vault" energy for a grief-and-closure product
- planning and executor modes do not feel emotionally distinct enough
- dashboard pages behave like CRUD modules instead of guided journeys
- packet, export, and billing pages look operator-facing instead of customer-facing
- landing page under-explains the real value of the product

## 7. Recommended Visual Direction

### Overall Look

Use a high-trust editorial-operational style.

Recommended direction:

- warm neutral base instead of pure dark default
- strong typography hierarchy
- structured cards and panels with less glow and less glass
- restrained accent colors
- clearer sectioning and more breathing room
- intentional contrast between planning mode and executor mode

### Suggested Color Logic

- Planning mode:
  - calm neutrals
  - muted greens or blue-greens for readiness and safety
  - soft amber for attention items
- Executor mode:
  - quiet neutrals
  - denser structure
  - muted red-amber only for blockers or legal risk
  - deeper green only for completed/resolved states

Avoid:

- neon cyber visuals
- overly glossy gradients
- playful consumer-fintech patterns
- visually noisy dashboards

### Suggested Typography

- Headline font: a serious editorial sans or humanist serif-sans pairing
- Body font: clean and highly legible sans
- Tables and reports: simpler, denser system for readability

Tone target:

- legal but not cold
- premium but not luxury
- supportive but not sentimental

## 8. Global Information Architecture

### Public

- Home
- How It Works
- Planning Mode
- After-Loss Mode
- Security And Legal
- Pricing
- Login
- Register
- Recovery

### Planning Workspace

- Overview
- Inventory
- Trusted People
- Documents
- Heartbeat
- Readiness
- Billing

Secondary utility areas:

- Packets
- Exports

### Executor Workspace

- Cases
- Case Workspace
- Subscription Bleed Stopper
- Closure Report

## 9. Primary Content Objects

These entities should feel consistent across the product:

- user
- inventory account
- recurring payment
- trusted contact
- executor
- document
- document version
- scan status
- heartbeat status
- case
- case review state
- case task
- evidence file
- closure report
- payment or entitlement

## 10. Global UX Rules

- Every screen should answer: What is this page for? What is the next action? What is the current status?
- Empty states should educate, not just announce absence.
- Success states should reinforce progress.
- Error states should explain impact and recovery path.
- Status language must be plain English.
- Routes with print intent should have dedicated printable layouts.
- Utility systems like jobs, scans, and exports should be translated into user language wherever possible.

## 11. State System To Design For

### Global

- loading
- success
- inline validation
- hard error
- empty state
- partial completion

### Documents

- upload pending
- quarantined
- scan pending
- clean
- infected
- scan failed
- soft deleted

### Trusted Contacts

- pending
- active
- revoked

### Heartbeat

- unconfigured
- active
- paused
- overdue
- escalated

### Cases

- activation pending
- pending review
- rejected review
- active
- closed

### Tasks

- not started
- in progress
- submitted
- waiting
- resolved
- escalated

### Payments

- created
- authorized
- captured
- failed
- refunded

## 12. Responsive Strategy

### Mobile Priorities

- fast status comprehension
- single-column flows
- add account
- add trusted contact
- upload document
- heartbeat check-in
- case triage
- task detail
- evidence upload

### Tablet Priorities

- list-detail layouts
- filter + content dual-column patterns
- faster task browsing
- better document and report review

### Desktop Priorities

- dense executor workspace
- Kanban plus list plus context
- side panels
- reporting and printing
- operational dashboards

### Print Priorities

- closure report
- bleed stopper
- any bank or support letter content

Print layouts must:

- remove decorative UI noise
- preserve dates and timestamps
- preserve status labels clearly
- preserve evidence references cleanly

## 13. Recommended Navigation Rewrite

### Public Navigation

- Home
- Planning
- After-Loss
- Security
- Pricing
- Login
- Get Started

### Planning Workspace Navigation

- Overview
- Accounts
- Trusted People
- Documents
- Heartbeat
- Readiness
- Billing

Move these to secondary nav or tools:

- Packet Generator
- Exports

### Executor Navigation

- Cases

Inside a case:

- Workspace
- Bleed Stopper
- Closure Report

## 14. Page-By-Page Brief

## 14.1 Home

Route: `/`

### User Goal

- understand what the product does
- understand who it is for
- trust it quickly
- pick the correct mode mentally

### Current Page Shows

- beta badge
- single hero
- one CTA
- three feature cards

### Problems With Current Page

- too little context
- does not properly explain the two-mode model
- sounds too much like a secure vault
- does not sell India-first relevance or legal execution value

### Redesign Intent

Make the landing page explain the problem, the two modes, the trust model, and the result.

### Desktop Structure

1. Hero
2. Problem framing
3. Two-mode explanation
4. How it works in 3-4 steps
5. Why families need this
6. Trust and legal principles
7. Key use cases
8. Pricing preview
9. FAQ
10. Final CTA

### Tablet Structure

- same order
- tighter cards
- reduce side-by-side content to stacked modules

### Mobile Structure

- hero
- problem
- two-mode cards
- trust block
- key steps
- CTA

### Content Notes

- explicitly say "We never touch credentials"
- explicitly say "built for India"
- explicitly say "for planning ahead and after-loss execution"

## 14.2 Login

Route: `/login`

### User Goal

- access the correct workspace quickly

### Current Page Shows

- email
- password
- forgot password

### Redesign Intent

Keep it simple, but make trust and context stronger.

### Recommended Additions

- short trust note
- link to planning mode explanation
- clear recovery path

### Layout

- centered auth card on mobile and desktop
- optional side trust panel on desktop only

## 14.3 Register

Route: `/register`

### User Goal

- create account
- understand why the app asks for specific data
- consent clearly

### Current Page Shows

- form fields
- policy versions
- email verification box

### Redesign Intent

Reduce the feel of a generic account form and connect the signup flow to readiness planning.

### Recommended Structure

1. account basics
2. why this matters
3. legal consent summary
4. verification step

### Important UX Note

The verification box can remain on the same screen, but it should visually read as step 2 of onboarding, not an unrelated second form.

## 14.4 Recovery

Route: `/recovery`

### User Goal

- reset password
- recover through backup channel or trusted contact

### Current Page Shows

- password reset flow
- assisted recovery flow
- approval and completion tokens

### Redesign Intent

Make this read as a guided recovery workflow instead of multiple unrelated token forms.

### Recommended Structure

1. choose recovery path
2. request token
3. approve if needed
4. finish recovery

### Mobile Priority

- single active section visible at a time

## 14.5 Planning Overview

Route: `/dashboard`

### User Goal

- understand readiness level
- know what still needs to be completed
- jump to next best action

### Current Page Shows

- count cards
- links to modules

### Problems

- metric-first, not readiness-first
- counts alone do not tell the user what matters

### Redesign Intent

Turn overview into a readiness dashboard.

### Recommended Sections

1. Readiness hero
   - readiness score or checklist completion
   - next recommended action
2. Critical gaps
   - no executor
   - no recovery contact
   - no documents
   - no recurring payments flagged
3. Quick stats
4. Core journeys
   - map accounts
   - add trusted people
   - upload documents
   - set heartbeat
5. Recent activity
6. Tools
   - packets
   - exports

### Desktop Layout

- left: readiness and next actions
- right: status summary and trust or legal tips
- below: structured module cards

### Mobile Layout

- readiness card
- urgent gaps
- next actions
- module list

## 14.6 Inventory

Route: `/dashboard/inventory`

### User Goal

- map important digital accounts
- prioritize them
- flag recurring payments

### Current Page Shows

- modal add/edit form
- list of accounts
- priority and recurring tags

### Redesign Intent

Make this feel like a digital estate map, not a raw records table.

### Recommended Sections

1. Intro header with why this matters
2. Add account CTA
3. Filters
   - category
   - priority
   - recurring
4. Grouped list or cards
   - communication
   - finance
   - social
   - work
   - subscriptions
5. Summary strip
   - total accounts
   - high-priority count
   - recurring monthly bleed estimate

### Desktop Layout

- top summary strip
- left filter rail
- right grouped account list

### Mobile Layout

- summary
- add button
- filters as chips or drawer
- accordion groups

### Interaction Notes

- recurring payment accounts should be visually distinct
- importance should use human labels, not only numbers
- example labels:
  - priority 5 = essential
  - priority 4 = high priority
  - priority 3 = important

## 14.7 Trusted People

Route: `/dashboard/trusted-contacts`

### User Goal

- define who can help after death or during recovery
- understand permissions clearly

### Current Page Shows

- create contact
- choose role
- invite
- accept token
- revoke

### Redesign Intent

Make this a people-and-permissions page, not a raw invite utility.

### Recommended Sections

1. Role guide
   - executor
   - viewer
   - packet access
   - recovery assist
2. Add person form
3. Pending invites
4. Active trusted people
5. Revoked history

### Desktop Layout

- role guide at top
- active people list as main content
- add person as side or drawer interaction

### Mobile Layout

- role guide cards
- add person CTA
- stacked people cards

### Important UX Note

Explain in plain language what each role can and cannot do.

## 14.8 Documents

Route: `/dashboard/documents`

### User Goal

- store important legal/support documents
- know whether they are usable
- grant access safely when needed

### Current Page Shows

- upload
- scan
- grant access
- list documents
- version list

### Redesign Intent

Make document trust state obvious.

### Recommended Sections

1. Document vault overview
2. Upload zone
3. Scan state legend
4. Active documents
5. Attention required
   - quarantined
   - failed scans
6. Access grants
7. Version history in details panel

### Desktop Layout

- left: documents list
- right: selected document detail

### Mobile Layout

- list first
- detail opens as full-screen sheet

### Important UX Note

Users care more about "Can this document be used?" than raw version metadata.

## 14.9 Heartbeat

Route: `/dashboard/heartbeat`

### User Goal

- understand how check-ins protect family readiness
- configure escalation safely

### Current Page Shows

- cadence selector
- enable toggle
- schedule snapshot
- recovery contact warning

### Redesign Intent

Show the heartbeat as a timeline, not a form field plus metadata block.

### Recommended Sections

1. Explanation of heartbeat
2. Cadence settings
3. Escalation timeline
   - reminder before due date
   - overdue reminder
   - follow-up reminder
   - recovery contact escalation
4. Recovery readiness warning
5. Last and next check-in details

### Mobile Layout

- single-column cards
- timeline as stacked steps

## 14.10 Packets

Route: `/dashboard/packets`

### User Goal

- generate custodian-specific closure packet artifacts

### Current Page Shows

- raw platform input
- queue job
- recent jobs list

### Redesign Intent

Translate this from a technical job queue into a user-facing legal packet generator.

### Recommended Structure

1. Packet purpose explanation
2. Platform chooser
3. Packet contents preview
4. Generation status
5. Recent packets

### Note

This page can stay secondary in navigation until the packet experience is more mature.

## 14.11 Exports

Route: `/dashboard/exports`

### User Goal

- export a secure bundle
- download through owner flow or one-time token flow

### Current Page Shows

- create export job
- refresh
- download options

### Redesign Intent

Keep it utility-focused but easier to understand.

### Recommended Structure

1. What an export contains
2. Create export
3. Recent export bundles
4. Download methods
   - owner download
   - one-time token download

### Note

This should likely remain a utility page, not a primary hero flow.

## 14.12 Billing

Route: `/dashboard/billing`

### Current Reality

Current screen is placeholder infrastructure:

- enter INR amount
- create order
- verify payment status

### Design Instruction

Do not use the current page shape as the final UX model.

### Future-State Redesign Intent

Build billing around product tiers:

- Free
- Essential
- Executor

### Recommended Future Sections

1. Current plan
2. Tier comparison
3. Upgrade CTA
4. Checkout status
5. Billing history
6. Invoice downloads

## 14.13 Executor Cases

Route: `/executor`

### User Goal

- see which cases are available
- understand status instantly
- take the next required action

### Current Page Shows

- accessible cases
- upload death certificate for pending case
- review state details
- open workspace for active case
- view closure report for closed case

### Redesign Intent

Make this a triage surface.

### Recommended Sections

1. Page intro
2. Case status tabs
   - pending activation
   - pending review
   - active
   - closed
3. Selected case detail panel
4. Activation or next-step panel

### Desktop Layout

- left: case list
- right: selected case detail and action panel

### Mobile Layout

- segmented status filter
- stacked case cards
- selected case details below

### Important UX Note

Review-state explanations must be explicit and plain:

- pending review
- rejected because of issue X
- upload replacement certificate

## 14.14 Executor Workspace

Route: `/executor/cases/[caseId]`

### User Goal

- understand overall case progress
- work through closure tasks
- upload proof
- manage recurring-payment issues
- keep an auditable trail

### Current Page Shows

- active case header
- summary counts
- bleed-stopper preview
- task filters
- 6-column Kanban
- activity timeline
- filtered task list
- task edit dialog
- evidence uploads and downloads

### This Is The Most Important Screen In The Product

It should receive the strongest design investment.

### Redesign Intent

Build this as a case control center.

### Recommended Desktop Layout

Top header:

- case identity
- status
- readiness
- key actions

Main body:

- left column: filters and task groups
- center: task board or list toggle
- right column: case summary, bleed-stopper alert, recent activity

Task detail:

- open as right-side panel instead of blocking modal on desktop

### Recommended Sections

1. Case hero
   - owner identity
   - activated date
   - total tasks
   - resolved count
   - waiting count
2. Urgent actions
   - recurring payments requiring action
   - tasks without evidence
   - submitted tasks waiting for reply
3. Task workspace
   - board view
   - list view
4. Task detail panel
   - status
   - notes
   - reference number
   - submitted date
   - evidence area
5. Activity timeline
6. Bleed-stopper summary card

### Mobile Layout

- summary header
- urgent actions
- task filters
- list view first
- task detail as full-screen sheet
- board view optional or simplified

### Strong Recommendations

- keep both board and list, but make list the default on mobile
- make evidence state much more prominent
- surface "missing proof" as a visible case risk
- show recurring-payment tasks with stronger visual treatment

## 14.15 Subscription Bleed Stopper

Route: `/executor/cases/[caseId]/bleed-stopper`

### User Goal

- stop recurring charges fast
- understand action steps per payment rail
- print a usable checklist

### Current Page Shows

- summary cards
- recurring task rows
- action steps
- printable dispute letter if card-based

### Redesign Intent

Make this a practical action document.

### Recommended Structure

1. Owner summary
2. Monthly bleed total
3. Requiring-action total
4. Prioritized recurring rows
5. Action steps
6. Template letters
7. Print guidance

### Mobile Layout

- single-column checklist cards
- sticky print and back actions

### Print Notes

- optimize for literal handoff to bank or family member
- use neutral visual language

## 14.16 Closure Report

Route: `/executor/cases/[caseId]/report`

### User Goal

- review closure readiness
- print or save official-looking evidence summary
- close the case when ready

### Current Page Shows

- report readiness
- warnings
- task table
- clean evidence references
- activity timeline
- print CTA
- close case CTA

### Redesign Intent

Make this feel official, rigorous, and shareable.

### Recommended Sections

1. Report header
2. Case summary
3. Readiness or warnings
4. Task table
5. Evidence references
6. Activity timeline
7. Closure notes

### Desktop Layout

- formal report styling
- cleaner, less app-like framing

### Mobile Layout

- stacked report sections
- sticky print action

### Print Design Requirements

- strong title hierarchy
- document-like spacing
- readable table density
- timestamps and status labels remain clear in grayscale

## 15. Component System Recommendations

Build a reusable system around these blocks:

- page hero
- status badge
- readiness card
- risk or blocker card
- empty-state card
- step timeline
- grouped data table
- task card
- case card
- document state row
- evidence card
- printable report section
- permission or role card

## 16. Copy Direction

### Voice

- clear
- humane
- legally careful
- non-dramatic

### Avoid

- hacker or vault language
- playful startup slang
- emotionally manipulative grief copy
- vague security buzzwords

### Prefer

- plain English
- concrete action labels
- clear consequences
- explicit state explanations

Examples:

- "Add an executor before relying on this plan."
- "This document passed security scanning and is available for use."
- "Manual review is in progress. You can upload a replacement certificate if this review is rejected."
- "Three recurring payments still require action."

## 17. Current Page To Target Page Mapping

- Landing page: from sparse marketing hero to trust-and-explanation funnel
- Dashboard overview: from module launcher to readiness dashboard
- Inventory: from CRUD list to account map
- Trusted contacts: from invite list to people-and-permissions workspace
- Documents: from upload utility to document trust center
- Heartbeat: from settings form to escalation timeline
- Packets: from raw job queue to packet generator
- Exports: from utility list to understandable export center
- Billing: from amount-based placeholder to tiered product billing
- Executor landing: from case list to triage center
- Executor workspace: from mixed content page to case control center
- Bleed stopper: from informative checklist to action document
- Closure report: from app report to formal printable proof document

## 18. Suggested Delivery Priority

### Phase 1

- landing page
- planning overview
- executor case workspace
- closure report

### Phase 2

- inventory
- trusted contacts
- documents
- bleed stopper

### Phase 3

- heartbeat
- packets
- exports
- auth polish

### Phase 4

- future-state billing UX once entitlements are implemented

## 19. Designer Handoff Checklist

- confirm planning mode and executor mode use distinct visual atmospheres
- confirm all shipped states are represented
- confirm print layouts exist for report and bleed stopper
- confirm mobile list-detail behavior for executor tasks
- confirm roadmap-only features are visually marked as future if included in concepts
- confirm every primary screen has a visible next action
- confirm every empty state teaches the user what to do next

## 20. Frontend Implementation Checklist

- create shared layout primitives before page rewrites
- separate planning and executor visual themes through variables and page wrappers
- redesign overview around readiness and next-action logic
- redesign executor workspace before secondary utility pages
- keep responsive rules intentional instead of inheriting current panel stacking
- keep print-specific styles for report and bleed stopper as dedicated layouts
- preserve all existing states and flows even if the visual structure changes

## 21. Recommended Next Deliverables

If continuing from this brief, the next best artifacts are:

1. a low-fidelity wireframe pack for desktop, tablet, and mobile
2. a design token proposal
3. a component inventory
4. a phased frontend implementation plan

