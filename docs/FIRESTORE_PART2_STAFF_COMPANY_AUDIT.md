# Firestore Part 2 — Staff & Company Audit

Generated from the single authoritative `cognitus-solutions/firestore.rules`.

- Rules source bytes: **201,641**
- Required Staff/Company collections: **21**

## Required Staff / Company collection coverage

- ✅ `staffDirectory`
- ✅ `staffAccess`
- ✅ `staffEmployment`
- ✅ `staffInbox`
- ✅ `commandTasks`
- ✅ `commandRequests`
- ✅ `commandProjects`
- ✅ `commandMeetings`
- ✅ `commandAnnouncements`
- ✅ `commandDocuments`
- ✅ `commandTickets`
- ✅ `commandLeave`
- ✅ `commandLifecycle`
- ✅ `commandFinance`
- ✅ `commandPayroll`
- ✅ `commandAvailability`
- ✅ `commandInternalAffairs`
- ✅ `commandPerformance`
- ✅ `commandPolicyAcknowledgements`
- ✅ `commandRecognition`
- ✅ `commandSuggestions`

## Security invariants

- ✅ product login does not imply staff access
- ✅ staff authorization is separate from product role
- ✅ staff directory is staff-only
- ✅ restricted employment records are HR/self scoped
- ✅ inbox is recipient scoped
- ✅ sensitive request routing enabled
- ✅ finance self-approval blocked
- ✅ payroll approval permission enforced
- ✅ internal affairs has dedicated restricted collection
- ✅ availability is employee-owned
- ✅ policy acknowledgements are immutable
- ✅ performance records have employee visibility
- ✅ recognition records are immutable
- ✅ suggestions are not company-public by default
- ✅ background checks still have no staff approval collection
- ✅ no composite index file dependency introduced
- ✅ default deny preserved
- ✅ Part 2 completion marker present

## Part 2 hardening

- Sensitive Request Center categories now route to the correct authority instead of generic department management.
- Finance submissions must begin pending and cannot be approved by their submitter.
- Payroll preparation and payroll approval are separated; statement creators cannot approve their own statement.
- Employees can cancel their own still-pending leave request; HR remains responsible for approval/decline.
- Internal Affairs now has a dedicated restricted staff-case collection.
- Availability, performance, policy acknowledgement, recognition, and suggestions/feedback have explicit Staff-side security boundaries.
- Background checks remain automatic/self-service; Part 2 adds no background-check approval queue.

## Findings

Missing required collections: none.
Failed invariants: none.
