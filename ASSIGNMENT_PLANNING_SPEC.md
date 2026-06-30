# Assignment Planning & Scheduling System
## Integration with Existing Features

---

## 📊 SYSTEM ARCHITECTURE

### Existing Components to Integrate
- **PlansPage.tsx** → Site Visit Scheduling
- **CalendarPage.tsx** → Visual Assignment Calendar
- **MyVisitsPage.tsx** → Daily Quota Display (✅ Already done)
- **EmployeesPage.tsx** → Sales Staff Management
- **AgencyAcquisitionPage.tsx** → Agency Database
- **NotificationCenterPage.tsx** → Notification Hub
- LINE OA Integration → Push Notifications

### New Components to Create
- **AssignmentPlannerPage.tsx** → Main planning dashboard
- **QuotaCalculatorService** → Working days + quota logic
- **RouteOptimizationService** → Geographic clustering
- **AutoRescheduleService** → Handle cancellations
- **KPIDashboard.tsx** → Performance metrics
- **ApprovalWorkflow.tsx** → Draft/Review/Publish

---

## 🗂️ DATABASE SCHEMA CHANGES

### Existing Tables to Extend
```
employee
├── add: workingDayTarget (default: 24)
├── add: salesArea (zone)
└── add: weeklyOff (e.g., "Sunday")

plan (visit_plans)
├── add: status (pending → confirmed → done)
├── add: callConfirmedAt
├── add: isNonVisitDay (training/meeting)
├── add: rescheduledFrom (track chain)
└── add: approvedBy (admin user)

agency
├── add: vipLevel (0-5, 0=regular, 5=VIP)
├── add: visitFrequency (days)
├── add: lastVisitDate
├── add: riskScore (AI calculated)
└── add: tier (standard/premium/vip)
```

### New Tables
```
WorkingCalendar
├── employeeId
├── date
├── type (working/holiday/leave/training/sick)
└── notes

AssignmentSchedule
├── employeeId
├── monthYear
├── status (draft → reviewing → approved)
├── version
├── approvedBy
├── publishedAt
└── auditLog[]

RouteOptimization
├── employeeId
├── date
├── agencies[] (ordered)
├── totalDistance
├── estimatedTime
└── sequence

KPIMetrics
├── employeeId
├── monthYear
├── workingDays (calculated)
├── visitTarget (24 × 3)
├── visitCompleted
├── visitRemaining
├── callConfirmRate
├── followupRate
├── newAgencyAdded
├── depositFollowup
└── completionPercentage
```

---

## 🔄 WORKING DAY RULES (Existing + New)

### Current State
- Calendar tracking: holidays, leave days
- MyVisitsPage: Shows daily visits

### To Add
```
WorkingDayCalculator
├── Input: Employee ID, Month
├── Process:
│   ├── Get company holidays from DB
│   ├── Get employee leave days
│   ├── Get training days
│   ├── Filter Sundays/Saturdays
│   └── Mark as "Non-Visit Days" (training/meeting)
├── Output: 
│   ├── workingDays = 24 (or actual count)
│   ├── nonVisitDays = [training dates]
│   └── availableVisitDays = workingDays - nonVisitDays
```

### Implementation Location
- **Route:** `/assignment-planner` → New page
- **Component:** AssignmentPlannerPage.tsx
- **Service:** WorkingDayCalculator.ts
- **API Endpoint:** GET `/scheduling/working-days?employeeId=X&month=YYYY-MM`

---

## 🎯 SITE VISIT QUOTA RULES (Existing + New)

### Current State ✅
- MyVisitsPage: Shows "3/3 quota met" daily
- PlansPage: Create individual visits

### To Add
```
SiteVisitQuotaEngine
├── Daily Quota: 3 visits minimum
├── Monthly Quota: 72 visits (24 days × 3)
├── Shortfall Handling:
│   ├── If Day X has <3 visits
│   └── Add shortfall to next days (auto-average)
├── Constraints:
│   ├── Cannot schedule <3 visits/day (except last day of month)
│   ├── Requires Closer/Admin approval for <3
│   └── Track approval reason
└── Output:
    ├── DailyQuota = [3,3,3,3,3...] for 24 days
    ├── MissingVisits = sum of shortfalls
    └── AveragedSchedule = redistributed
```

### Implementation Location
- **Update:** MyVisitsPage.tsx (add shortfall indicator)
- **Update:** PlansPage.tsx (add quota validation)
- **Service:** QuotaCalculator.ts
- **API:** GET `/visits/quota?employeeId=X&month=YYYY-MM`
- **API:** PUT `/visits/quota/approve?planId=X`

---

## 🏢 AGENCY ASSIGNMENT RULES (New)

### Assignment Priority Scoring
```
AgencyAssignmentEngine
├── Score Calculation (0-100):
│   ├── Days Since Visit: (daysSince / 30) × 20 points
│   ├── VIP Level: vipLevel × 15 points
│   ├── AI Risk Score: riskScore × 15 points
│   ├── New Agency: isNew × 20 points
│   ├── Geographic Cluster: sameZoneBonus × 15 points
│   ├── Last Appointment: appointmentAge × 10 points
│   └── Sales Performance: recentSales × 5 points
├── Output: Sorted agencies by score (highest = visit first)
└── Constraint: No same agency on consecutive days
```

### Implementation Location
- **New:** AssignmentEngine.ts
- **New:** AssignmentPlannerPage.tsx (drag-drop interface)
- **API:** POST `/assignments/generate?employeeId=X&month=YYYY-MM`
- **API:** PUT `/assignments/:id` (manual override)

---

## 🗺️ ROUTE OPTIMIZATION (New)

### Geographic Clustering
```
RouteOptimizer
├── Input: 
│   ├── Agencies to visit (3+ per day)
│   ├── Employee location
│   └── Agency coordinates
├── Process:
│   ├── Group by zone/district
│   ├── Calculate distances
│   ├── Order by time window
│   └── Minimize crossings
├── Output:
│   ├── OptimalRoute = [Agency1, Agency2, Agency3]
│   ├── TotalDistance
│   ├── EstimatedTime
│   └── Sequence
└── Constraints:
    ├── Avoid multi-province trips
    ├── Respect appointment times
    └── Minimize backtracking
```

### Implementation Location
- **New:** RouteOptimizationService.ts
- **Update:** CalendarPage.tsx (show route on map)
- **API:** POST `/routes/optimize?employeeId=X&date=YYYY-MM-DD`

---

## 📞 APPOINTMENT RULES (Existing + New)

### Current State
- PlansPage: Call Confirm workflow
- Line notifications for reminders

### To Add
```
AppointmentRulesEngine
├── Pre-Visit Requirements:
│   ├── status = "waiting_confirmation"
│   ├── Call must be made day before (08:00-17:00)
│   ├── Result: confirmed/rescheduled/cancelled
│   └── 2-hour pre-visit reminder
├── Rescheduling Logic:
│   ├── If agency asks to reschedule
│   ├── Find next available slot
│   ├── Auto-pull backup agency for shortfall
│   ├── Update plan status
│   └── Notify via LINE
└── Backup Strategy:
    ├── If no backup available
    ├── Notify Closer immediately
    └── Flag for manual assignment
```

### Implementation Location
- **Update:** PlansPage.tsx (call confirm workflow)
- **New:** RescheduleEngine.ts
- **Update:** NotificationCenterPage.tsx
- **API:** PUT `/visits/plans/:id/reschedule`
- **API:** POST `/visits/backup-agency?date=X&zoneId=Y`

---

## 📋 DAILY WORKLOAD MIX (New)

### Recommended Daily Tasks
```
DailyWorkloadBuilder
├── Site Visits: 3 (minimum)
├── Call Confirmations: 3 (for next day)
├── Follow-ups: 1-2 (from previous visits)
├── Other Tasks:
│   ├── Deposit follow-up
│   ├── Showroom appointment
│   ├── PR/Training
│   └── Admin tasks
└── Constraint: Site Visits cannot drop <3
```

### Implementation Location
- **Update:** MyVisitsPage.tsx (show full daily agenda)
- **New:** DailyTaskAggregator.ts
- **Component:** DailyAgendaCard.tsx
- **API:** GET `/tasks/daily-agenda?employeeId=X&date=YYYY-MM-DD`

---

## 📊 KPI TRACKING (New)

### 11 KPI Metrics to Track
```
KPIDashboard Component
├── Working Days (actual)
├── Site Visit Target (72)
├── Site Visit Completed (count)
├── Site Visit Remaining (72 - completed)
├── Call Confirm Rate (%)
├── Follow-up Completion (%)
├── New Agency Added (count)
├── Showroom Appointment (count)
├── Deposit Follow-up (count)
├── Task Completion (%)
└── On-time Completion (%)
```

### Implementation Location
- **New:** KPIDashboard.tsx
- **Update:** DashboardPage.tsx (add KPI section)
- **Service:** KPICalculator.ts
- **API:** GET `/kpis/monthly?employeeId=X&month=YYYY-MM`

---

## 🤖 AUTO-RESCHEDULE RULES (New)

### Trigger Events
```
AutoRescheduleEngine
├── Trigger: Agency cancels
├── Trigger: Agency reschedules
├── Trigger: Sales calls in sick
├── Trigger: Emergency holiday added
├── Trigger: Weather/Force majeure
│
├── Action:
│   ├── Recalculate available slots
│   ├── Find backup agencies
│   ├── Maintain 72-visit target
│   ├── Optimize new route
│   ├── Send notifications
│   └── Alert Closer if needed
│
└── Notification:
    ├── Sales via LINE (08:00 daily)
    ├── Closer (if backup needed)
    └── Manager (if quota at risk)
```

### Implementation Location
- **New:** AutoRescheduleService.ts
- **New:** RescheduleNotificationService.ts
- **API:** POST `/reschedule/auto-apply?planId=X`
- **Scheduler:** Cron job (daily 23:00)

---

## ✅ APPROVAL WORKFLOW (New)

### 3-Stage Approval Process
```
AssignmentApprovalWorkflow
├── Stage 1: AI Draft
│   ├── AI generates monthly schedule
│   ├── Status: "draft"
│   ├── Auto-calculate quota
│   └── Ready for review
├── Stage 2: Closer Review
│   ├── Closer reviews each day
│   ├── Can edit/override
│   ├── Can mark as "non-visit day"
│   ├── Can approve or request changes
│   └── Version tracking
└── Stage 3: Admin Publish
    ├── Admin final approval
    ├── Publish to sales
    ├── Send LINE notification
    ├── Lock for edits (except via change request)
    └── Audit log created
```

### Implementation Location
- **New:** ApprovalWorkflowPage.tsx
- **Update:** PlansPage.tsx (status: draft/approved)
- **API:** 
  - POST `/assignments/draft`
  - PUT `/assignments/:id/review`
  - POST `/assignments/:id/publish`
  - GET `/assignments/audit-log`

---

## 🔔 NOTIFICATION RULES (Existing + New)

### 6 Notification Types via LINE OA
```
NotificationEngine
├── 1. Schedule Published
│   └── "Your schedule for July approved. See at app."
├── 2. Daily Brief (08:00)
│   └── "Today: 3 visits scheduled. First at 09:00"
├── 3. Pre-Visit Reminder (1 day before)
│   └── "Tomorrow visit: XYZ Agency at 10:00"
├── 4. Pre-Visit Reminder (2 hours before)
│   └── "Visit XYZ Agency in 2 hours at 10:00"
├── 5. Rescheduled Notice
│   └── "Plan changed: ABC Agency moved to tomorrow"
└── 6. Quota Alert
    └── "Today only 2 visits. Need 1 more for daily target"
```

### Implementation Location
- **Update:** NotificationCenterPage.tsx
- **Update:** SmartNotificationService.ts
- **API:** POST `/notifications/send?type=X`
- **Scheduler:** Cron jobs (08:00, 24hrs before, 2hrs before)

---

## 🧠 AI PLANNING ALGORITHM (New - Advanced)

### Multi-Factor Optimization
```
AIPlanner
├── Input Data:
│   ├── Working days (24)
│   ├── Available visit days
│   ├── Agencies database (500+ records)
│   ├── VIP levels & frequencies
│   ├── AI Risk Scores
│   ├── Last visit dates
│   ├── Geographic zones
│   ├── Appointment requests
│   ├── Deposit follow-ups
│   └── Sales history
│
├── Algorithm:
│   ├── Day 1: Assign highest-priority agencies
│   ├── Check geographic clustering
│   ├── Optimize route (min distance)
│   ├── Day 2-24: Balance across all agencies
│   ├── Ensure 3-visit minimum/day
│   ├── Meet VIP visit frequency
│   ├── Prioritize at-risk (high score) agencies
│   └── Maintain 72-visit monthly target
│
└── Output:
    ├── Monthly schedule (24 days × 3)
    ├── Route optimization per day
    ├── Call confirm schedule
    ├── Follow-up assignments
    └── Confidence score (70-100%)
```

### Implementation Location
- **New:** AIPlanner.ts (Python/Node service)
- **API:** POST `/ai/generate-schedule?employeeId=X&month=YYYY-MM`
- **Webhook:** Accept schedule, return to UI

---

## 📍 INTEGRATION POINTS - EXISTING PAGES

### 1. PlansPage.tsx
```
Add:
├── Import ApprovalWorkflow
├── Add status filter: (draft/approved/done)
├── Add quota validation on create
├── Add call-confirm workflow
└── Update delete to check approval status
```

### 2. MyVisitsPage.tsx ✅
```
Already done:
├── Daily quota display (3/day)
├── Progress bar
├── Holiday detection
└── Shortfall indicator
```

### 3. CalendarPage.tsx
```
Add:
├── Show assignments by date
├── Highlight non-visit days
├── Show route optimization
└── Filter by employee
```

### 4. EmployeesPage.tsx
```
Add:
├── workingDayTarget field
├── salesArea/zone assignment
├── weeklyOff configuration
└── KPI summary widget
```

### 5. DashboardPage.tsx
```
Add:
├── Monthly KPI summary cards
├── Sales leaderboard
├── At-risk quota warnings
└── Approval workflow queue
```

---

## 🗺️ IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-2)
- [x] Working day calculator
- [x] Site visit quota display (done)
- [ ] Database schema for assignments
- [ ] AssignmentPlannerPage UI (basic)
- [ ] Approval workflow (draft/review/publish)

### Phase 2: Optimization (Weeks 3-4)
- [ ] Route optimization service
- [ ] Agency scoring algorithm
- [ ] Appointment confirmation workflow
- [ ] Auto-reschedule engine
- [ ] KPI dashboard

### Phase 3: Intelligence (Weeks 5-6)
- [ ] AI planning algorithm
- [ ] Advanced notifications
- [ ] Audit logging
- [ ] Backup agency selection
- [ ] Performance analytics

### Phase 4: Polish (Week 7)
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] User documentation

---

## 🚀 QUICK START API ENDPOINTS

```
GET    /scheduling/working-days?employeeId=X&month=YYYY-MM
POST   /assignments/generate?employeeId=X&month=YYYY-MM
GET    /assignments/:id
PUT    /assignments/:id (review/edit)
POST   /assignments/:id/publish
PUT    /visits/plans/:id/reschedule
GET    /kpis/monthly?employeeId=X&month=YYYY-MM
POST   /notifications/send?type=X
GET    /routes/optimize?employeeId=X&date=YYYY-MM-DD
```

---

## 📌 PRIORITY ORDER

1. **Working Day Rules** ← Foundation
2. **Site Visit Quota** ← Already have daily, need monthly tracking
3. **Approval Workflow** ← Enables all other features
4. **Agency Assignment** ← Core scheduling
5. **Route Optimization** ← Efficiency
6. **Auto-Reschedule** ← Reliability
7. **KPI Dashboard** ← Monitoring
8. **AI Planner** ← Advanced

---

**Status: Ready to implement Phase 1 - Working Days + Assignment Foundation**

Shall I start with Phase 1?
