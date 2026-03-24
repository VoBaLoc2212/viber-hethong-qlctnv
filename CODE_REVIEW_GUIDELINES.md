# Module Responsibilities & Code Review Guidelines

## 👥 Team Assignment (4 Developers)

### **Developer 1: Budgeting & Budget Control**
**Full Name:** [To be filled]
**GitHub:** [@username]
**Email:** [email@company.com]
**Time Zone:** [UTC+7]

**Primary Modules:**
- ✅ Module 1: Budgeting (Budget period creation, allocation)
- ✅ Module 4: Budget Control (Hard stops, sub-budgets)
- ⚠️ Assists: Module 3 encumbrance logic

**Responsible For:**
```
Backend:
- apps/backend/src/routes/budget.ts (all budget endpoints)
- apps/backend/src/services/budget.service.ts
- apps/backend/src/services/budget-control.service.ts
- apps/backend/src/lib/budget-calculation.ts
- Database: budget_periods, budget_allocations tables

Frontend:
- apps/frontend/src/app/(budget)/* (all budget pages)
- apps/frontend/src/components/budget/* (all budget components)
- apps/frontend/src/hooks/useBudget.ts
- API client: lib/api-client-react (budget endpoints)
```

**Sprint Tasks:**
- Week 1: Backend - Budget CRUD endpoints + validation
- Week 2: Frontend - Budget dashboard + allocation form
- Week 3: Budget transfer + audit logging
- Week 4: Testing + optimization

**Communication Channel:** @dev1 on Slack
**Code Review Frequency:** Daily check-ins

---

### **Developer 2: Transactions & Payments**
**Full Name:** [To be filled]
**GitHub:** [@username]
**Email:** [email@company.com]
**Time Zone:** [UTC+7]

**Primary Modules:**
- ✅ Module 2: Transactions (Income/expense creation)
- ✅ Module 6: Reimbursement workflow
- ⚠️ Assists: Module 7 multi-currency

**Responsible For:**
```
Backend:
- apps/backend/src/routes/transactions.ts (all transaction endpoints)
- apps/backend/src/services/transaction.service.ts
- apps/backend/src/lib/transaction-code-generator.ts
- apps/backend/src/lib/transaction-validator.ts
- Database: transactions, attachments, recurring_transactions

Frontend:
- apps/frontend/src/app/(transactions)/* (all transaction pages)
- apps/frontend/src/components/transactions/* (all transaction components)
- apps/frontend/src/hooks/useTransaction.ts
- Attachment upload component
- Recurring transaction form
```

**Sprint Tasks:**
- Week 1: Backend - Transaction CRUD + attachment handler
- Week 2: Frontend - Transaction form + list view
- Week 3: Recurring transactions + split transactions
- Week 4: Testing + performance optimization

**Communication Channel:** @dev2 on Slack
**Code Review Frequency:** Daily check-ins

---

### **Developer 3: Approval Workflow & Controls**
**Full Name:** [To be filled]
**GitHub:** [@username]
**Email:** [email@company.com]
**Time Zone:** [UTC+7]

**Primary Modules:**
- ✅ Module 3: Approval Process (Multi-level approvals)
- ✅ Module 4: Budget Control (Encumbrance logic)
- ⚠️ Assists: Module 9 Security logging

**Responsible For:**
```
Backend:
- apps/backend/src/routes/approvals.ts (all approval endpoints)
- apps/backend/src/services/approval.service.ts
- apps/backend/src/services/encumbrance.service.ts
- apps/backend/src/lib/approval-level-checker.ts
- apps/backend/src/lib/budget-encumbrance.ts
- Database: approval_workflows, reserved_budgets

Frontend:
- apps/frontend/src/app/(approvals)/* (approval pages)
- apps/frontend/src/components/approvals/* (approval components)
- apps/frontend/src/hooks/useApproval.ts
- Approval queue dashboard
- Approval history view
```

**Sprint Tasks:**
- Week 1: Backend - Approval workflow + level checking
- Week 2: Frontend - Approval queue + action buttons
- Week 3: Encumbrance logic + budget blocking
- Week 4: Notification integration + testing

**Communication Channel:** @dev3 on Slack
**Code Review Frequency:** Daily check-ins

---

### **Developer 4: Reports, Analytics & Reconciliation**
**Full Name:** [To be filled]
**GitHub:** [@username]
**Email:** [email@company.com]
**Time Zone:** [UTC+7]

**Primary Modules:**
- ✅ Module 5: Cashbook (Financial ledger)
- ✅ Module 6: Bank Reconciliation
- ✅ Module 8: Financial Reports (Charts + analysis)
- ⚠️ Assists: Module 7 currency conversion

**Responsible For:**
```
Backend:
- apps/backend/src/routes/reconciliation.ts
- apps/backend/src/routes/reports.ts
- apps/backend/src/routes/cashbook.ts
- apps/backend/src/services/reconciliation.service.ts
- apps/backend/src/services/report.service.ts
- apps/backend/src/services/cashbook.service.ts
- apps/backend/src/lib/variance-calculator.ts
- Database: cashbooks, reconciliations, audit_logs

Frontend:
- apps/frontend/src/app/(reports)/* (report pages)
- apps/frontend/src/components/reports/* (report components)
- apps/frontend/src/components/charts/* (all chart components)
- apps/frontend/src/hooks/useReport.ts
- Reconciliation tool UI
- Dashboard visualizations
```

**Sprint Tasks:**
- Week 1: Backend - Cashbook + reconciliation endpoints
- Week 2: Frontend - Basic reports + simple charts
- Week 3: Advanced reports + variance analysis
- Week 4: Dashboarding + performance optimization

**Communication Channel:** @dev4 on Slack
**Code Review Frequency:** Daily check-ins

---

## 🔄 Cross-Team Responsibilities

### Shared Components (Collaborative Work)
```
✅ Authentication & Authorization
   └─ All developers contribute
   └─ Lead: Team lead or designated security owner

✅ API Client Code Generation
   └─ Auto-generated from OpenAPI spec
   └─ lib/api-spec/openapi.yaml (all contribute)
   └─ lib/api-zod/src/generated/ (auto-generated)

✅ UI Kit Components
   └─ apps/frontend/src/components/ui/ (shared library)
   └─ All developers maintain
   └─ Code review required even for UI component updates

✅ Database Migrations
   └─ All developers contribute new migrations
   └─ Lead: Database architect reviews

✅ API Documentation
   └─ Each developer documents their endpoints
   └─ Centralized in OpenAPI spec
```

---

## 📋 Code Review Checklist

### General Code Quality

**Readability**
- [ ] Code is clear and easy to understand
- [ ] Variable/function names are descriptive
- [ ] No magic numbers (use constants instead)
- [ ] Comments explain "why", not "what"
- [ ] Code follows project style guide

**Functionality**
- [ ] Implements the required feature completely
- [ ] Handles edge cases (null, empty, boundary conditions)
- [ ] Error handling is appropriate
- [ ] No console.log or debug statements left
- [ ] No commented-out code left

**Performance**
- [ ] No obvious performance issues
- [ ] Database queries are optimized (indexed)
- [ ] No N+1 query problems
- [ ] No unnecessary loops or iterations
- [ ] Async operations used appropriately

**Security**
- [ ] SQL injection vulnerabilities checked
- [ ] Input validation on all user input
- [ ] Authentication/authorization checks present
- [ ] No hardcoded secrets/credentials
- [ ] HTTPS enforced in appropriate places

**Testing**
- [ ] Unit tests added for new functionality
- [ ] Integration tests verify feature end-to-end
- [ ] Test coverage is adequate (>70%)
- [ ] Tests are meaningful, not just mocking everything
- [ ] Edge cases are tested

**Database**
- [ ] Schema changes are backward compatible
- [ ] Migrations included if schema changed
- [ ] Foreign key constraints proper
- [ ] Indexes added for frequently queried fields
- [ ] No N+1 queries detected

### Backend-Specific

**API Design**
- [ ] REST conventions followed (GET, POST, PUT, DELETE)
- [ ] HTTP status codes are correct
- [ ] Response format is consistent
- [ ] API versioning strategy followed
- [ ] Pagination implemented for list endpoints

**Code Organization**
- [ ] Routes properly organized by module
- [ ] Services handle business logic
- [ ] Middleware handles cross-cutting concerns
- [ ] Dependency injection used appropriately
- [ ] No circular dependencies

**Error Handling**
- [ ] Errors are caught and handled properly
- [ ] Error messages are helpful for debugging
- [ ] Errors are logged with context
- [ ] Appropriate HTTP status codes returned
- [ ] Stack traces not exposed to client

### Frontend-Specific

**React Best Practices**
- [ ] Components are functional (no class components)
- [ ] Hooks used correctly (no rules violations)
- [ ] Props are properly typed (TypeScript)
- [ ] No unnecessary re-renders
- [ ] State management is appropriate

**UI/UX**
- [ ] UI matches design system
- [ ] Responsive design tested
- [ ] Accessibility (a11y) considered
- [ ] Loading states shown
- [ ] Error messages are user-friendly

**Code Organization**
- [ ] Components are small and focused
- [ ] Custom hooks extracted when needed
- [ ] No logic in presentation layers
- [ ] Types defined properly
- [ ] Separation of concerns maintained

### Module-Specific Review Points

#### Budget Module (Dev 1)
```
Backend:
- [ ] Budget period dates validated (start < end)
- [ ] No negative allocations possible
- [ ] Budget calculations accurate
- [ ] Concurrent edits handled

Frontend:
- [ ] Budget allocation table updates in real-time
- [ ] Form validation prevents invalid changes
- [ ] Budget health indicators accurate
```

#### Transaction Module (Dev 2)
```
Backend:
- [ ] Transaction codes unique and sortable
- [ ] Attachments validated and stored securely
- [ ] Recurring transactions generate correctly
- [ ] Split transactions don't exceed original amount

Frontend:
- [ ] File upload shows progress
- [ ] Transaction form fields validated
- [ ] Recurring pattern preview shown
```

#### Approval Module (Dev 3)
```
Backend:
- [ ] Approval levels enforced
- [ ] Approvers cannot be approving their own request
- [ ] Reserved budget updated correctly
- [ ] Notifications sent on status change

Frontend:
- [ ] Approval queue shows pending actions
- [ ] Comments required before rejection
- [ ] Cannot approve/reject twice
```

#### Reports Module (Dev 4)
```
Backend:
- [ ] Reports calculate correctly for date ranges
- [ ] Reconciliation variance is accurate
- [ ] Charts data is properly aggregated
- [ ] Performance acceptable for large datasets

Frontend:
- [ ] Charts render correctly
- [ ] Date range filters work properly
- [ ] Export functionality works
```

---

## 💬 Review Comments Guidelines

### Positive Comments
```
✅ "Nice approach to handling null values!"
✅ "I like how you extracted this into a separate function"
✅ "Great test coverage for edge cases"
```

### Constructive Comments
```
⚠️ "This query might have N+1 issues. Consider using JOIN"
⚠️ "Could we extract this logic into a separate function?"
⚠️ "Have you considered the performance impact when scaling?"
```

### Approval Comments
```
✅ "Looks great! Approving."
✅ "All my concerns addressed. Ready to merge."
```

---

## 🚨 When to Request Changes

**Request Changes if:**
- Security vulnerability exists
- Performance issue will affect scalability
- Code violates team standards
- Tests are missing for new functionality
- Database changes aren't backward compatible
- Edge cases aren't handled

**Approve with Comments if:**
- Minor issues (style, naming) that don't block
- Feature is good but could be improved later
- Tests could be more comprehensive

---

## ⏱️ Review SLA (Service Level Agreement)

| Priority | Response Time | Merge Time |
|----------|---------------|-----------|
| Blocking | < 2 hours | < 4 hours |
| High | < 6 hours | < 24 hours |
| Normal | < 24 hours | < 48 hours |
| Low | < 48 hours | < 72 hours |

---

## 📞 Escalation Process

If review stalls:
1. **24 hours:** Ping reviewer on Slack
2. **48 hours:** Notify team lead
3. **72 hours:** Can merge with team lead approval if blocking other work

---

## 🎓 Code Review Best Practices

### As a Reviewer
- Focus on intent, not just syntax
- Ask questions instead of making demands
- Praise good solutions
- Be specific with feedback
- Test the changes locally if possible
- Approve when satisfied

### As an Author
- Keep PRs small (< 400 lines)
- Write descriptive PR description
- Respond to comments promptly
- Don't be defensive
- Ask for clarification if needed
- Thank reviewers for their time

