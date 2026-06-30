# Cognitus Solutions Project Plan

## Stack Boundary

Cognitus V1 will use:

- GitHub Pages
- Firebase Authentication
- Cloud Firestore
- Browser-side JavaScript modules

Cognitus V1 will not use:

- Firebase Hosting
- Cloud Functions
- Firebase Storage
- A traditional backend server
- A public API

## Core Design Principles

1. Checks require accounts.
2. Every check requires a reason.
3. Every major entity receives a permanent Cognitus ID.
4. Firestore creates collections through app writes instead of manual collection setup.
5. Frontend route guards improve user experience, but Firestore Security Rules enforce security.
6. Reports should support both concerns and positive professional history.
7. Appeals and corrections must preserve audit history.
8. Organization-private notes must remain visible only to that organization.

## Cognitus ID Format for V1

Because there is no trusted backend counter in V1, IDs use a unique hybrid format:

```text
USR-26-8F3A91
ORG-26-4D71BC
RPT-26-91E2F4
CHK-26-A3C8D7
APL-26-Z9N3B5
```

This avoids fragile client-side sequential counters while still giving the system professional, stable, human-readable IDs.

## Planned Parts

### Part 1 — Project Foundation

Static shell, base styles, router placeholders, constants, Cognitus ID utility, Firebase placeholders, documentation.

### Part 2 — Authentication and Remember Me

Discord ID login using Firebase email/password internally, synthetic local email format, registration, persistence selection, logout.

### Part 3 — Owner Bootstrap and Roles

Owner Discord ID bootstrap, role handling, protected routes, role-based navigation.

### Part 4 — Firestore Models and Services

Data services for users, organizations, profiles, reports, claims, appeals, checks, downloads, notifications, audit logs.

### Part 5 — Public Pages

Home, About, Terms, Privacy, account access pages, public feature explanations.

### Part 6 — User Dashboard

Account dashboard, recent checks, saved people, saved organizations, notifications, profile claim entry.

### Part 7 — Search and Check Logging

People search, organization search, required reason modal, check log creation, search results.

### Part 8 — Reports and Downloads

Quick report, full report, browser PDF generation, downloaded report logs, report disclaimer.

### Part 9 — Claims, Appeals, Reports, and Reviews

Submit report, claim profile, correction requests, appeals, reviewer queues, status workflows.

### Part 10 — Admin and Owner Dashboards

Manage users, organizations, staff, records, duplicate reviews, verification, password resets, audit logs.

### Part 11 — Final Integration and Polish

Navigation cleanup, empty states, loading states, error handling, responsive polish.

### Part 12 — Testing and Deployment Configuration

Firebase project setup, authentication provider, Firestore database, rules, indexes, GitHub Pages setup, launch checklist.
