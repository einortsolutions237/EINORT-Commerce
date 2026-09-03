---
phase: quick/260903-fsr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements: [QUICK-260903-fsr]
---

<objective>
Reconcile the stale "~20 template variations" figure across PROJECT.md, REQUIREMENTS.md,
and ROADMAP.md with the locked 10 Starter / 15 Business / 25 Professional (50 total)
template-tier split the user confirmed on 2026-08-31. Pure text correction, no code, no
ambiguity — the target numbers are already locked.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Replace every "~20 template variations" occurrence with the locked 50/10/15/25 figure</name>
  <files>.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>
  <action>
PROJECT.md line 20: "~20 visually distinct storefront template variations" -> "50 visually
distinct storefront template variations (10 Starter / 15 Business / 25 Professional)";
"not 20 independently bespoke designs" -> "not 50 independently bespoke designs".

PROJECT.md line 41: "20 independently hand-designed bespoke templates" -> "50 independently
hand-designed bespoke templates".

PROJECT.md line 70: "~20 template variations via Theme→Page→Section→Block recombination,
not 20 bespoke designs" -> "50 template variations (10 Starter / 15 Business / 25
Professional) via Theme→Page→Section→Block recombination, not 50 bespoke designs".

REQUIREMENTS.md line 32 (TMPL-04): "~20 visually distinct variations" -> "50 visually
distinct variations (10 Starter / 15 Business / 25 Professional tier split)"; "not 20
independently designed templates" -> "not 50 independently designed templates".

ROADMAP.md Phase 5 Goal line: "~20 visually distinct variations" -> "50 visually distinct
variations (10 Starter / 15 Business / 25 Professional)".

ROADMAP.md Phase 5 Success Criteria item 2: "~20 visually distinct variations" -> "50
visually distinct variations (10 Starter / 15 Business / 25 Professional)"; "not 20
independently designed templates" -> "not 50 independently designed templates".

Do NOT touch PROJECT.md line 31 (the unrelated "~20-module admin surface" mention).
  </action>
  <read_first>.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md</read_first>
  <acceptance_criteria>
`grep -n "~20" .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md` returns
only the PROJECT.md line-31 admin-surface mention, nothing else.
`grep -c "50 visually distinct\|50 template variations\|50 independently" .planning/PROJECT.md`
returns 3. `grep -c "50 visually distinct variations" .planning/REQUIREMENTS.md` returns 1.
`grep -c "50 visually distinct variations" .planning/ROADMAP.md` returns 2.
  </acceptance_criteria>
  <verify>
    <automated>bash -c 'grep -n "~20" .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md | grep -v "module admin surface" | grep -q . && exit 1 || exit 0'</automated>
  </verify>
  <done>All three planning docs read 50 (10/15/25) wherever the template-variation count is stated; no stray "~20" remains in that context.</done>
</task>

</tasks>

<output>
Create `.planning/quick/260903-fsr-reconcile-template-tier-count/260903-fsr-SUMMARY.md` when done.
</output>
