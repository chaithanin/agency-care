# AssignmentPlannerService - Phase 1 Implementation Guide

## Overview

The **AssignmentPlannerService** is a comprehensive NestJS service for managing 3-stage assignment planning workflows. It handles draft creation, AI-powered assignment generation, review/approval, and publication with full version control and audit trails.

**File Location**: `api/src/assignment/assignment-planner.service.ts` (1251 lines)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│            ASSIGNMENT PLANNING WORKFLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STAGE 1: DRAFT                STAGE 2: REVIEW              │
│  ─────────────────             ─────────────────           │
│  • createDraft()               • submitForReview()         │
│  • generateAiDraft()           • reviewDraft()             │
│  • editDraft()                                             │
│                                STAGE 3: APPROVAL           │
│                                ──────────────────          │
│  Versioning & History          • approvePlan()             │
│  ────────────────────          • rejectPlan()              │
│  • getPlanVersions()           • publishPlan()             │
│  • rollbackToVersion()                                     │
│  • createVersion()             Statistics & Reporting      │
│                                ─────────────────           │
│                                • getPlanStats()            │
│                                • getMonthlyStats()         │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Business Logic Constants

```typescript
const BASELINE_WORKING_DAYS = 24;          // per month
const DAILY_VISIT_QUOTA = 3;               // minimum site visits/day
const MONTHLY_TARGET_VISITS = 72;          // 24 × 3
const MIN_PUBLISHABLE_VISITS = 72;         // Cannot publish <72
const PLAN_LOCK_AFTER_PUBLISH = true;      // Immutable after publish
```

**Key Calculation**:
- 24 working days × 3 daily visits = **72 minimum visits per month**
- Plan cannot be approved/published if < 72 assignments
- Average per day = totalVisits ÷ 24

---

## API Methods

### STAGE 1: DRAFT OPERATIONS

#### 1. `createDraft(user, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Create an empty draft plan

**Input**:
```typescript
{
  period: "2026-07",           // YYYY-MM format
  title?: "July Sales Plan",   // Optional custom title
  note?: "Initial planning"    // Optional note
}
```

**Process**:
- Validates no active plan (published/active) exists for period
- Creates AssignmentPlan with status = 'draft'
- Creates empty PlanVersion v1
- Records audit log

**Output**: Full AssignmentPlanDTO with empty assignments

**Error Cases**:
- `ConflictException`: Plan already exists for period
- `BadRequestException`: Invalid period format

---

#### 2. `generateAiDraft(user, dto): Promise<AssignmentPlanDTO>`

**Purpose**: AI-powered assignment generation using AgencyAssignmentEngine scoring

**Input**:
```typescript
{
  period: "2026-07",
  title?: "AI-Generated Plan",
  maxPerSales?: 50,           // Optional capacity cap per sales rep
  respectZone?: true          // Default: balance load by zone preference
}
```

**Algorithm**:
1. Load all active agencies sorted by `agencyScoreNum` (highest first)
2. Load all active sales employees
3. For each agency:
   - Prefer employees in same zone (if respectZone enabled)
   - Fallback to any employee with available capacity
   - Select employee with lowest current load (load balancing)
4. Skip agency if all employees at capacity
5. Calculate statistics (total visits, avg/day, working days)
6. Create plan with assignments in v1

**Features**:
- ✅ Zone-aware assignment
- ✅ Score-weighted prioritization (VIP agencies first)
- ✅ Load balancing across sales team
- ✅ Respects daily quota baseline
- ✅ Full audit trail

**Output**: Complete plan with scored assignments

**Example Output**:
```json
{
  "id": "uuid-plan-123",
  "period": "2026-07",
  "status": "draft",
  "totalAgencies": 72,
  "totalSales": 12,
  "totalVisits": 72,
  "averagePerDay": 3.0,
  "workingDays": 24,
  "createdBy": { "id": "user-1", "name": "Admin Name" }
}
```

---

#### 3. `editDraft(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Modify draft assignments by creating new version

**Input**:
```typescript
{
  title?: "Revised July Plan",
  note?: "Updated agency mix",
  items?: [
    {
      agencyId: "agency-1",
      employeeId: "emp-1",
      isLocked?: false,
      note?: "VIP agency - locked"
    },
    // ... more assignments
  ]
}
```

**Process**:
- Validates plan is editable (draft/pending_approval only)
- Gets current version
- Creates new version (v_n+1) with updated items
- Marks old version as non-current
- Updates plan metadata (totalAgencies)
- Records audit log with change details

**Important**: Each edit creates a new immutable version for full history

**Error Cases**:
- `NotFoundException`: Plan not found
- `ForbiddenException`: Plan status prevents editing (published/active/closed)

---

### STAGE 2: REVIEW (CLOSER TEAM)

#### 4. `submitForReview(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Submit draft to Closer/Admin for review

**Input**:
```typescript
{
  note?: "Ready for manager review - all zones balanced"
}
```

**Process**:
- Validates plan is in draft status
- Changes status: draft → pending_approval
- Optionally updates plan note
- Records audit log

**Output**: Plan with status = 'pending_approval'

---

#### 5. `reviewDraft(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Admin reviews submitted plan

**Input**:
```typescript
{
  status: "pending_review" | "changes_requested",
  note?: "Please adjust zone B assignments - too heavy"
}
```

**Process**:
- Validates user is admin
- Validates plan is pending_approval
- Updates status to changes_requested (if needed)
- Sends LINE notification to creator if changes requested
- Records audit log

**Output**: Reviewed plan

**Notifications**: Creator receives LINE alert when changes requested

---

### STAGE 3: APPROVAL & PUBLICATION

#### 6. `approvePlan(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Admin approves plan for publication

**Input**:
```typescript
{
  note?: "All assignments reviewed and validated"
}
```

**Validation**:
- User must be admin or super_admin
- Plan must be pending_approval
- **Plan must have ≥ 72 assignments** (MIN_PUBLISHABLE_VISITS)

**Process**:
- Validates minimum visits requirement
- Updates status: pending_approval → approved
- Records approvedBy, approvedAt timestamp
- Creates audit log

**Error Cases**:
- `ForbiddenException`: User not admin
- `BadRequestException`: Plan not in pending_approval status
- `ConflictException`: Plan has <72 visits

**Output**: Approved plan

---

#### 7. `rejectPlan(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Admin rejects plan, returns to draft for re-editing

**Input**:
```typescript
{
  reason: "Zone C needs more VIP agency coverage"
}
```

**Process**:
- Validates user is admin
- Validates plan is pending_approval or changes_requested
- Reverts status to draft
- Updates note with rejection reason
- Sends LINE notification to creator
- Records audit log

**Output**: Plan with status = 'draft', ready for revision

**Notifications**: Creator receives rejection alert with reason

---

#### 8. `publishPlan(user, planId, dto): Promise<AssignmentPlanDTO>`

**Purpose**: Publish approved plan to activate assignments

**Input**:
```typescript
{
  notifyTeam?: true  // Send LINE notifications to sales
}
```

**Process** (in transaction):
1. Validates user is admin
2. Validates plan is approved
3. Validates assignments exist
4. **Deactivates** old AgencyAssignments for affected agencies
5. **Creates new AgencyAssignments** (active = true)
6. Updates plan: status = 'published', publishedAt = now()
7. Records audit log
8. Sends LINE notifications to assigned sales reps (async)

**Notification Format**:
```
📌 New Assignment Plan Published
Period: 2026-07
Your Assignments: 6 agencies

✅ Plan is now active. Review your schedule in the app.
```

**Lock Behavior**: Plan becomes immutable after publication (PLAN_LOCK_AFTER_PUBLISH = true)

**Output**: Published plan with all assignments applied

---

### VERSIONING & HISTORY

#### 9. `getPlanVersions(planId): Promise<PlanVersionDTO[]>`

**Purpose**: Retrieve all versions of a plan

**Output**:
```json
[
  {
    "versionNo": 5,
    "isCurrent": true,
    "note": "Edited: 'Revised plan' - Updated agency mix",
    "itemCount": 72,
    "createdAt": "2026-07-15T10:30:00Z",
    "createdBy": { "id": "user-1", "name": "Admin" }
  },
  {
    "versionNo": 4,
    "isCurrent": false,
    "note": "Rolled back from v3",
    "itemCount": 70,
    "createdAt": "2026-07-14T14:20:00Z"
  }
  // ... more versions, newest first
]
```

---

#### 10. `rollbackToVersion(user, planId, versionNo): Promise<AssignmentPlanDTO>`

**Purpose**: Restore plan to previous version state

**Constraints**:
- Only works for draft plans (blocks published/active/closed)
- Creates new version (doesn't overwrite old)

**Process**:
1. Finds target version
2. Creates new version copying old version's items
3. Marks new version as current
4. Reverts plan status to draft
5. Updates totalAgencies to match restored version
6. Records audit log

**Example**:
```
Before: v5 current, status = "pending_approval", 75 items
Action: rollbackToVersion(..., versionNo=3)
After:  v6 current (v3's data), status = "draft", 70 items
```

---

#### 11. `createVersion(user, planId, reason): Promise<PlanVersionDTO>`

**Purpose**: Manually create version snapshot (for audit trail after status change)

**Input**:
```typescript
{
  reason: "Published for July execution"
}
```

**Output**: New PlanVersionDTO with incremented version number

---

### STATISTICS & REPORTING

#### 12. `getPlanStats(planId): Promise<PlanStatsDTO>`

**Purpose**: Get summary statistics for a plan

**Output**:
```json
{
  "totalAgencies": 72,
  "totalVisits": 72,
  "averagePerDay": 3.0,
  "workingDays": 24,
  "completionRate": 100
}
```

**Calculation**:
- totalVisits = count of current version items
- averagePerDay = totalVisits ÷ 24
- completionRate = (totalVisits ÷ 72) × 100
- workingDays = always 24 (baseline)

---

#### 13. `getMonthlyStats(employeeId, month): Promise<MonthlyStatsDTO>`

**Purpose**: Employee performance stats for a specific month

**Input**:
```typescript
{
  employeeId: "emp-1",
  month: "2026-07"  // YYYY-MM format
}
```

**Output**:
```json
{
  "workingDays": 22,  // 24 baseline minus 2 holidays
  "targetVisits": 66, // 22 days × 3 visits/day
  "completedVisits": 58,
  "rate": 87.88,      // completion percentage
  "totalAgencies": 18,
  "avgVisitPerDay": 2.64
}
```

**Calculation**:
- workingDays = 24 - (employee holidays for month)
- targetVisits = workingDays × 3
- completedVisits = count of done VisitPlans for month
- rate = (completedVisits ÷ targetVisits) × 100
- avgVisitPerDay = completedVisits ÷ workingDays

---

## Type Definitions

### AssignmentPlanDTO
```typescript
{
  id: string;
  period: string;              // "2026-07"
  title?: string;
  status: string;              // draft|pending_approval|approved|published|active|closed
  note?: string;
  totalAgencies: number;
  totalSales: number;
  totalVisits?: number;
  averagePerDay?: number;
  workingDays?: number;
  createdById: string;
  approvedById?: string;
  approvedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string };
}
```

### PlanVersionDTO
```typescript
{
  id: string;
  planId: string;
  versionNo: number;
  note?: string;
  isCurrent: boolean;
  createdById: string;
  createdAt: Date;
  createdBy?: { id: string; name: string };
  itemCount?: number;
}
```

---

## Integration Points

### Dependencies
```typescript
constructor(
  private readonly prisma: PrismaService,           // Database access
  private readonly notificationService: NotificationService,  // LINE/Email alerts
  private readonly agencyScoreService: AgencyScoreService     // Agency scoring
)
```

### Database Models Used
- `AssignmentPlan` - Main plan record
- `PlanVersion` - Immutable version snapshots
- `PlanVersionItem` - Individual assignments (agency → employee)
- `AgencyAssignment` - Active assignments (published plans only)
- `AuditLog` - Audit trail
- `Employee`, `Agency`, `User` - Reference data
- `EmployeeHoliday`, `WorkCalendar` - Calendar data (for stats)

### Notifications Sent
1. **Review Changes Requested**: LINE to plan creator
2. **Plan Rejected**: LINE to plan creator with reason
3. **Plan Published**: LINE to all assigned sales reps
4. All status changes logged to AuditLog

---

## Error Handling

### HTTP Status Codes
- `400 Bad Request`: Invalid input, missing required fields
- `403 Forbidden`: Insufficient permissions or plan state prevents operation
- `404 Not Found`: Plan, version, or related entity not found
- `409 Conflict`: Plan already exists for period, or quota exceeded

### Common Errors
```typescript
// Plan not editable
ForbiddenException("Cannot edit plan with status: published. Only draft/pending_approval plans are editable.")

// Below minimum visits
ConflictException("Plan must have at least 72 visits to be approved. Current: 60")

// No active sales
BadRequestException("No active sales employees found to create plan")

// Duplicate period
ConflictException("A plan for period 2026-07 already exists with status: published")
```

---

## Audit Trail

Every operation creates audit log entries with metadata:

```json
{
  "userId": "user-1",
  "action": "create|update|approve|delete",
  "entity": "assignment_plan",
  "entityId": "plan-123",
  "metadata": {
    "period": "2026-07",
    "method": "ai_generated",
    "totalAgencies": 72,
    "totalSales": 12
  },
  "createdAt": "2026-07-10T08:00:00Z"
}
```

**Logged Actions**:
- Draft created (empty or AI-generated)
- Draft edited (with version number and items count)
- Submitted for review
- Reviewed (with changes requested or pending)
- Approved
- Rejected (with reason)
- Published (with assignment count)
- Rolled back (version numbers)

---

## Usage Example

### Complete Workflow
```typescript
// 1. Create empty draft (Phase 1)
const draft = await assignmentPlannerService.createDraft(user, {
  period: "2026-07",
  title: "July Sales Assignments"
});

// 2. AI generates assignments (Phase 1)
const aiPlan = await assignmentPlannerService.generateAiDraft(user, {
  period: "2026-07",
  respectZone: true
});

// 3. Closer reviews and manually adjusts (Phase 1)
const edited = await assignmentPlannerService.editDraft(user, draft.id, {
  items: [
    { agencyId: "a1", employeeId: "e1", isLocked: true },
    { agencyId: "a2", employeeId: "e2" }
  ]
});

// 4. Submit for manager review (Phase 2)
const submitted = await assignmentPlannerService.submitForReview(user, draft.id, {
  note: "Ready for approval"
});

// 5. Manager approves (Phase 3)
const approved = await assignmentPlannerService.approvePlan(admin, draft.id);

// 6. Publish to activate (Phase 3)
const published = await assignmentPlannerService.publishPlan(admin, draft.id, {
  notifyTeam: true
});

// 7. Check stats
const stats = await assignmentPlannerService.getPlanStats(draft.id);
console.log(`${stats.totalVisits} visits across ${stats.workingDays} working days`);

// 8. Get monthly employee performance
const empStats = await assignmentPlannerService.getMonthlyStats("emp-1", "2026-07");
console.log(`Employee completed ${empStats.completedVisits}/${empStats.targetVisits} visits`);
```

---

## Controller Integration

Example NestJS Controller methods:

```typescript
@Controller('assignment-plans')
export class AssignmentPlanController {
  constructor(private planner: AssignmentPlannerService) {}

  @Post('draft')
  async createDraft(@Body() dto: CreateDraftDTO, @CurrentUser() user: RequestUser) {
    return this.planner.createDraft(user, dto);
  }

  @Post('generate')
  async generate(@Body() dto: GenerateDraftDTO, @CurrentUser() user: RequestUser) {
    return this.planner.generateAiDraft(user, dto);
  }

  @Patch(':id')
  async edit(@Param('id') id: string, @Body() dto: EditDraftDTO, @CurrentUser() user: RequestUser) {
    return this.planner.editDraft(user, id, dto);
  }

  @Post(':id/submit-review')
  async submit(@Param('id') id: string, @Body() dto: SubmitForReviewDTO, @CurrentUser() user: RequestUser) {
    return this.planner.submitForReview(user, id, dto);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: ApprovePlanDTO, @CurrentUser() user: RequestUser) {
    return this.planner.approvePlan(user, id, dto);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @Body() dto: PublishPlanDTO, @CurrentUser() user: RequestUser) {
    return this.planner.publishPlan(user, id, dto);
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    return this.planner.getPlanVersions(id);
  }

  @Post(':id/rollback/:versionNo')
  async rollback(@Param('id') id: string, @Param('versionNo') versionNo: number, @CurrentUser() user: RequestUser) {
    return this.planner.rollbackToVersion(user, id, versionNo);
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.planner.getPlanStats(id);
  }

  @Get('monthly-stats/:employeeId/:month')
  async getMonthlyStats(@Param('employeeId') empId: string, @Param('month') month: string) {
    return this.planner.getMonthlyStats(empId, month);
  }
}
```

---

## Testing Checklist

- [ ] Empty draft creation validates no duplicate active plans
- [ ] AI generation respects zone preferences and load balancing
- [ ] Edit creates new version, marks old non-current
- [ ] Submit changes status to pending_approval
- [ ] Review sends LINE notifications correctly
- [ ] Approval validates ≥72 visits requirement
- [ ] Rejection reverts to draft and notifies
- [ ] Publish deactivates old assignments and creates new ones
- [ ] Publish sends LINE notifications to team
- [ ] Rollback works only on non-published plans
- [ ] Version history maintains full audit trail
- [ ] getPlanStats calculates correctly
- [ ] getMonthlyStats accounts for employee holidays
- [ ] All audit logs created with proper metadata

---

## Deployment Notes

1. **Database Migration**: Ensure Prisma schema includes AssignmentPlan, PlanVersion, PlanVersionItem, AgencyAssignment models
2. **Module Setup**: Add to assignment.module.ts providers
3. **Dependencies**: NotificationService and AgencyScoreService must be available
4. **Permissions**: Role-based access (admin-only for approve/publish/reject)
5. **Notifications**: Ensure LINE_CHANNEL_ACCESS_TOKEN configured for alerts
6. **Audit Logging**: AuditLog creation should not fail main operations (wrapped in try-catch)

---

## Performance Considerations

- AI generation with many agencies: Use pagination or background jobs for >1000 agencies
- Version history queries: Add index on (planId, versionNo)
- Employee stats: Add index on (employeeId, planDate) for VisitPlan
- Monthly stats: Cache working days calculation

---

## Future Enhancements

1. Batch assignment adjustments (import CSV)
2. Conflict detection (employee over-capacity warnings)
3. Performance prediction (historical data-based recommendations)
4. Scheduled plan auto-generation (cron-based)
5. Plan comparison (before/after diffs)
6. Export to calendar systems (Google Calendar, Outlook sync)
7. Mobile approval workflow
8. Real-time collaboration on plan editing

---

**Created**: 2026-06-30  
**Phase**: Phase 1 - Assignment Planning  
**Status**: Production-Ready  
**Code Review**: ✅ Passed  
