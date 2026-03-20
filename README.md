# UK ADB Fire Safety Red-Flag Engine

A deterministic rule-based compliance engine for identifying fire safety risks in buildings using structured logic derived from UK Approved Document B.

---

## Overview

This project analyses structured building facts and evaluates them against a deterministic fire safety rule engine.

It is designed as a portfolio-grade PropTech / built-environment compliance project that demonstrates:

- structured fact ingestion and normalization
- deterministic rule evaluation
- risk scoring and compliance classification
- evidence and mitigation generation
- report-ready outputs for review workflows

---

## Important scope note

This engine does **not** represent complete implementation of the full official fire safety document.

What is implemented is a structured and formalised subset of Approved Document B that has been translated into deterministic rule logic.

That means:

- implemented rules are executable and testable
- some guidance in the source document has **not yet** been formalised into rules
- some provisions are better treated as interpretative or manual-review items rather than strict deterministic checks

This project should therefore be understood as a **deterministic compliance layer**, not full regulatory digitisation.

---

## Example Output (Quick View)

Sample result from rule evaluation:

- Risk Score: **HIGH**
- Failed Rules: **12**
- Critical Issues:
  - Missing fire compartmentation between uses
  - Escape distance exceeds allowable limits
  - Inadequate fire separation in hazard rooms

Each rule produces:

- status (`PASS`, `FAIL`, or `UNKNOWN`)
- reason for decision
- supporting evidence
- mitigation recommendation

---

## Why this matters

Fire safety issues are often identified too late in design and review workflows.

This engine supports earlier identification of regulatory red flags by converting building data into structured compliance signals.

It demonstrates how regulatory guidance can be translated into an auditable software workflow rather than being handled only through manual reading and ad hoc review.

---

## Engine coverage

Current implementation covers a substantial deterministic subset of Approved Document B.

The project includes:

- hundreds of structured rule definitions
- deterministic rule logic for defined rules
- executable evaluation flows
- testable outputs and coverage artifacts

Important distinction:

- **implemented rules** = rules already defined in this engine and backed by logic
- **document coverage** = broader question of how much of the official source guidance has been translated into rule form

This repository should only claim the first with confidence.

---

## What is included

The engine is strongest where guidance is suitable for deterministic evaluation, such as:

- travel distance checks
- escape route conditions
- compartmentation requirements
- cavity barrier conditions
- structural fire resistance checks
- selected external fire spread rules
- selected firefighting access requirements

---

## Known gaps

Not all regulatory content is suitable for direct deterministic encoding.

Areas that may remain incomplete, interpretative, or dependent on expert judgment include:

- performance-based design solutions
- diagram-heavy provisions
- context-sensitive trade-offs and compensatory measures
- clauses that need holistic fire-engineering judgment
- provisions not yet converted into formal rule objects

These should be treated as future work or manual-review layers.

---

## System pipeline

```text
Input Documents / Project Facts
        ↓
Ingestion
        ↓
Extraction
        ↓
Fact Processing and Normalization
        ↓
Rule Evaluation
        ↓
Risk Scoring
        ↓
Report / Output Artifacts