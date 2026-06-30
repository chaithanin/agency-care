# Quick Start: AssignmentPlannerService Integration

## Installation & Setup (5 minutes)

### Step 1: Register Service in Module

**File**: `api/src/assignment/assignment.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AssignmentPlanService } from './assignment-plan.service';
import { AssignmentPlannerService } from './assignment-planner.service';  // ADD THIS
import { AssignmentPlanController } from './assignment-plan.controller';
import { NotificationModule } from '../notification/notification.module';   // ADD THIS
import { AgencyModule } from '../agency/agency.module';                     // ADD THIS

@Module({
  imports: [NotificationModule, AgencyModule],  // ADD THIS
  providers: [
    AssignmentPlanService,
    AssignmentPlannerService,  // ADD THIS
  ],
  controllers: [AssignmentPlanController],
  exports: [AssignmentPlannerService],  // ADD THIS - export for other modules
})
export class AssignmentPlanModule {}
```

### Step 2: Add to Controller

**File**: `api/src/assignment/assignment-plan.controller.ts`

```typescript
import { AssignmentPlannerService } from './assignment-planner.service';

@Controller('api/assignment-plans')
export class AssignmentPlanController {
  constructor(
    private readonly assignmentPlanService: AssignmentPlanService,
    private readonly plannerService: AssignmentPlannerService,  // ADD THIS
  ) {}

  // ... existing endpoints ...

  // === NEW ENDPOINTS FOR ASSIGNMENT PLANNER ===

  @Post('draft')
  async createDraft(@Body() dto: CreateDraftDTO, @CurrentUser() user: RequestUser) {
    return this.plannerService.createDraft(user, dto);
  }

  @Post('generate-ai')
  async generateAiDraft(@Body() dto: GenerateDraftDTO, @CurrentUser() user: RequestUser) {
    return this.plannerService.generateAiDraft(user, dto);
  }

  @Patch(':id')
  async editDraft(
    @Param('id') id: string,
    @Body() dto: EditDraftDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.editDraft(user, id, dto);
  }

  @Post(':id/submit-review')
  async submitForReview(
    @Param('id') id: string,
    @Body() dto: SubmitForReviewDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.submitForReview(user, id, dto);
  }

  @Post(':id/review')
  async reviewDraft(
    @Param('id') id: string,
    @Body() dto: ReviewDraftDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.reviewDraft(user, id, dto);
  }

  @Post(':id/approve')
  async approvePlan(
    @Param('id') id: string,
    @Body() dto: ApprovePlanDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.approvePlan(user, id, dto);
  }

  @Post(':id/reject')
  async rejectPlan(
    @Param('id') id: string,
    @Body() dto: RejectPlanDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.rejectPlan(user, id, dto);
  }

  @Post(':id/publish')
  async publishPlan(
    @Param('id') id: string,
    @Body() dto: PublishPlanDTO,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.publishPlan(user, id, dto);
  }

  @Get(':id/versions')
  async getPlanVersions(@Param('id') id: string) {
    return this.plannerService.getPlanVersions(id);
  }

  @Post(':id/rollback/:versionNo')
  async rollbackToVersion(
    @Param('id') id: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannerService.rollbackToVersion(user, id, versionNo);
  }

  @Get(':id/stats')
  async getPlanStats(@Param('id') id: string) {
    return this.plannerService.getPlanStats(id);
  }

  @Get('monthly-stats/:employeeId/:month')
  async getMonthlyStats(
    @Param('employeeId') employeeId: string,
    @Param('month') month: string,
  ) {
    return this.plannerService.getMonthlyStats(employeeId, month);
  }
}
```

### Step 3: Create DTO file

**File**: `api/src/assignment/assignment-planner.dto.ts`

```typescript
import { IsString, IsOptional, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class CreateDraftDTO {
  @IsString()
  period: string; // "2026-07"

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class GenerateDraftDTO {
  @IsString()
  period: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  maxPerSales?: number;

  @IsOptional()
  @IsBoolean()
  respectZone?: boolean;
}

export class EditDraftDTO {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  items?: Array<{
    agencyId: string;
    employeeId: string;
    isLocked?: boolean;
    note?: string;
  }>;
}

export class SubmitForReviewDTO {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewDraftDTO {
  @IsString()
  status: 'pending_review' | 'changes_requested';

  @IsOptional()
  @IsString()
  note?: string;
}

export class ApprovePlanDTO {
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectPlanDTO {
  @IsString()
  reason: string;
}

export class PublishPlanDTO {
  @IsOptional()
  @IsBoolean()
  notifyTeam?: boolean;
}
```

---

## Usage Examples

### Example 1: Create and AI-Generate Assignment Plan

```bash
# 1. Create empty draft
curl -X POST http://localhost:3000/api/assignment-plans/draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "2026-07",
    "title": "July Sales Assignments"
  }'

# Response:
{
  "id": "plan-abc123",
  "period": "2026-07",
  "title": "July Sales Assignments",
  "status": "draft",
  "totalAgencies": 0,
  "totalSales": 0,
  "createdAt": "2026-07-01T08:00:00Z"
}

# 2. Generate AI assignments
curl -X POST http://localhost:3000/api/assignment-plans/generate-ai \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period": "2026-07",
    "respectZone": true,
    "maxPerSales": 50
  }'

# Response includes AI-scored assignments
```

### Example 2: Review and Approval Workflow

```bash
# 1. Closer reviews and requests changes
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/submit-review \
  -H "Authorization: Bearer $CLOSER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Ready for manager review"
  }'

# 2. Admin reviews (can be pending_review or changes_requested)
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/review \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "changes_requested",
    "note": "Zone B needs adjustment - too many high-score agencies on 1 person"
  }'
# Closer receives LINE notification about changes

# 3. Closer makes adjustments by editing
curl -X PATCH http://localhost:3000/api/assignment-plans/plan-xyz \
  -H "Authorization: Bearer $CLOSER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Updated zone B distribution",
    "items": [
      { "agencyId": "a1", "employeeId": "e1" },
      { "agencyId": "a2", "employeeId": "e2" },
      { "agencyId": "a3", "employeeId": "e3" }
    ]
  }'

# 4. Resubmit for approval
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/submit-review \
  -H "Authorization: Bearer $CLOSER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Revised and ready" }'

# 5. Admin approves
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Approved - all assignments validated" }'

# 6. Admin publishes to activate
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/publish \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "notifyTeam": true }'
# All sales team members receive LINE notification
```

### Example 3: Check Statistics

```bash
# Get plan statistics
curl http://localhost:3000/api/assignment-plans/plan-xyz/stats \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "totalAgencies": 72,
  "totalVisits": 72,
  "averagePerDay": 3.0,
  "workingDays": 24,
  "completionRate": 100
}

# Get employee monthly performance
curl http://localhost:3000/api/assignment-plans/monthly-stats/emp-001/2026-07 \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "workingDays": 22,
  "targetVisits": 66,
  "completedVisits": 58,
  "rate": 87.88,
  "totalAgencies": 18,
  "avgVisitPerDay": 2.64
}
```

### Example 4: Version Control and Rollback

```bash
# Get all versions
curl http://localhost:3000/api/assignment-plans/plan-xyz/versions \
  -H "Authorization: Bearer $TOKEN"

# Response:
[
  {
    "versionNo": 3,
    "isCurrent": true,
    "note": "Rolled back from v2",
    "itemCount": 72,
    "createdAt": "2026-07-10T14:00:00Z"
  },
  {
    "versionNo": 2,
    "isCurrent": false,
    "note": "Edited: 'Revised plan'",
    "itemCount": 70,
    "createdAt": "2026-07-10T10:00:00Z"
  },
  {
    "versionNo": 1,
    "isCurrent": false,
    "note": "AI-generated with 72 agencies...",
    "itemCount": 72,
    "createdAt": "2026-07-09T08:00:00Z"
  }
]

# Rollback to version 1 (creates v4)
curl -X POST http://localhost:3000/api/assignment-plans/plan-xyz/rollback/1 \
  -H "Authorization: Bearer $TOKEN"

# Response: Plan with v4 = v1's data, status = "draft"
```

---

## API Reference Quick Table

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/draft` | Any | Create empty draft |
| POST | `/generate-ai` | Any | AI-generate assignments |
| PATCH | `/:id` | Any | Edit draft → new version |
| POST | `/:id/submit-review` | Any | Submit for review |
| POST | `/:id/review` | Admin | Review and set status |
| POST | `/:id/approve` | Admin | Approve for publication |
| POST | `/:id/reject` | Admin | Reject and return to draft |
| POST | `/:id/publish` | Admin | Publish and activate |
| GET | `/:id/versions` | Any | Get all versions |
| POST | `/:id/rollback/:versionNo` | Any | Restore previous version |
| GET | `/:id/stats` | Any | Get plan statistics |
| GET | `/monthly-stats/:empId/:month` | Any | Get employee stats |

---

## Status Workflow

```
draft
  ↓ submitForReview()
pending_approval
  ↓ reviewDraft() → "changes_requested"
  ↓ editDraft() → new version
pending_approval (resubmit)
  ↓ approvePlan()
approved
  ↓ publishPlan()
published
  ↓ (system, next month)
active
  ↓ (system, month end)
closed
```

**Notes**:
- `rejectPlan()` reverts any status → `draft`
- `editDraft()` always creates new version
- `publishPlan()` LOCKS plan (no more edits allowed)

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Plan must have at least 72 visits to be approved. Current: 60",
  "error": "Bad Request"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Cannot edit plan with status: published. Only draft/pending_approval plans are editable.",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Plan not found: plan-xyz",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "A plan for period 2026-07 already exists with status: published",
  "error": "Conflict"
}
```

---

## Testing Checklist

```bash
# 1. Create draft
POST /api/assignment-plans/draft
Body: { "period": "2026-07", "title": "Test Plan" }
Expected: 200, status="draft", totalAgencies=0

# 2. Generate AI
POST /api/assignment-plans/generate-ai
Body: { "period": "2026-07", "respectZone": true }
Expected: 200, status="draft", totalAgencies=72, totalVisits=72

# 3. Edit
PATCH /api/assignment-plans/{id}
Body: { "title": "Updated", "items": [...] }
Expected: 200, version incremented

# 4. Get versions
GET /api/assignment-plans/{id}/versions
Expected: 200, array of versions with isCurrent flags

# 5. Submit
POST /api/assignment-plans/{id}/submit-review
Expected: 200, status="pending_approval"

# 6. Review
POST /api/assignment-plans/{id}/review
Body: { "status": "pending_review", "note": "..." }
Expected: 200, status changed

# 7. Approve
POST /api/assignment-plans/{id}/approve
Expected: 200, status="approved"

# 8. Publish
POST /api/assignment-plans/{id}/publish
Expected: 200, status="published"

# 9. Check stats
GET /api/assignment-plans/{id}/stats
Expected: 200, { totalVisits: 72, averagePerDay: 3.0 }

# 10. Monthly stats
GET /api/assignment-plans/monthly-stats/emp-001/2026-07
Expected: 200, { workingDays, targetVisits, completedVisits, rate }
```

---

## Troubleshooting

### "Plan already exists for period"
- Ensure no published/active plans exist for that period
- Use different period or archive existing plan

### "Plan must have at least 72 visits"
- Add more agencies to plan via editDraft()
- Check if items are actually being saved

### "Only admin can approve"
- Ensure user role includes 'admin' or 'super_admin'
- Check RequestUser decorator is working

### LINE notifications not sending
- Verify LINE_CHANNEL_ACCESS_TOKEN is set in .env
- Check employee.lineUserId is populated
- Review logs: `[NotificationService]`

### Audit logs not created
- Check AuditLog table permissions
- Audit failures are wrapped in try-catch, won't block main operation

---

## Next Steps

1. ✅ Add service to module (DONE)
2. ✅ Create DTOs (DONE)
3. ✅ Add controller endpoints (DONE)
4. Create integration tests
5. Add API documentation (Swagger/OpenAPI)
6. Deploy to staging environment
7. Run smoke tests
8. Deploy to production

---

**Ready to integrate!** Follow the setup steps above and your assignment planning workflow is live.
