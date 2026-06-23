import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from './current-user.decorator';

// ตรวจว่า user มีสิทธิ์บันทึกข้อมูลในแผนเยี่ยมนี้:
// admin/closer = ทุกแผน, sales = เฉพาะแผนของตัวเอง
export async function assertVisitAccess(
  prisma: PrismaService,
  user: RequestUser,
  visitPlanId: string,
) {
  const plan = await prisma.visitPlan.findUnique({ where: { id: visitPlanId } });
  if (!plan) throw new NotFoundException('ไม่พบแผนการเยี่ยม');
  if (user.activeRole === 'sales') {
    const emp = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!emp || plan.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
  }
  return plan;
}
