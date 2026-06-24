import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private prisma: PrismaService) {}

  // Run daily at 08:00 Bangkok time
  @Cron('0 8 * * *', { timeZone: 'Asia/Bangkok' })
  async runDailyReminders() {
    this.logger.log('Running daily reminders...');
    await Promise.allSettled([
      this.contractExpiryAlerts(),
      this.noVisitAlerts(),
      this.noSaleAlerts(),
      this.noFollowupAlerts(),
      this.unconfirmedVisitAlerts(),
    ]);
    this.logger.log('Daily reminders done');
  }

  // 1. Contract expiry: 90, 60, 30, 7 days before
  private async contractExpiryAlerts() {
    const today = new Date();
    const milestones = [90, 60, 30, 7];
    const adminUsers = await this.prisma.user.findMany({
      where: { role: { in: ['admin', 'super_admin'] }, isActive: true },
      select: { id: true },
    });

    for (const days of milestones) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + days);
      const next = new Date(targetDate);
      next.setDate(targetDate.getDate() + 1);

      const agencies = await this.prisma.agency.findMany({
        where: {
          agreementActive: true,
          agreementExpiry: { gte: targetDate, lt: next },
        },
        select: { id: true, name: true },
      });

      for (const ag of agencies) {
        const notifs = adminUsers.map((u) => ({
          userId: u.id,
          title: days <= 7 ? '⚠️ สัญญาใกล้หมด!' : '📋 แจ้งเตือนสัญญา',
          body: `สัญญา ${ag.name} จะหมดใน ${days} วัน`,
          type: 'contract_expiry',
          link: `/agencies`,
        }));
        if (notifs.length) {
          await this.prisma.inAppNotification.createMany({
            data: notifs,
            skipDuplicates: true,
          });
        }
      }
    }
  }

  // 2. No visit in 30 days
  private async noVisitAlerts() {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const agencies = await this.prisma.agency.findMany({
      where: {
        status: 'active',
        lastVisitAt: { lt: cutoff },
        assignments: { some: { isActive: true } },
      },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            employee: { include: { user: true } },
          },
        },
      },
      take: 200,
    });

    for (const ag of agencies) {
      for (const asg of ag.assignments) {
        if (!asg.employee.user?.id) continue;
        await this.prisma.inAppNotification.create({
          data: {
            userId: asg.employee.user.id,
            title: '📍 ยังไม่ได้เยี่ยม 30 วัน',
            body: `${ag.name} ยังไม่ได้เข้าเยี่ยม 30 วันแล้ว`,
            type: 'no_visit_30d',
            link: `/agencies`,
          },
        });
      }
    }
  }

  // 3. No sale in 60 days
  private async noSaleAlerts() {
    const cutoff = new Date(Date.now() - 60 * 86400000);
    const agencies = await this.prisma.agency.findMany({
      where: {
        status: 'active',
        sellsOurProjects: true,
        assignments: { some: { isActive: true } },
        visitPlans: {
          none: {
            status: 'done',
            planDate: { gte: cutoff },
            salesActivities: { some: { qtySold: { gt: 0 } } },
          },
        },
      },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            employee: { include: { user: true } },
          },
        },
      },
      take: 100,
    });

    for (const ag of agencies) {
      for (const asg of ag.assignments) {
        if (!asg.employee.user?.id) continue;
        await this.prisma.inAppNotification.create({
          data: {
            userId: asg.employee.user.id,
            title: '💰 ไม่มียอดขาย 60 วัน',
            body: `${ag.name} ไม่มียอดขายมา 60 วันแล้ว`,
            type: 'no_sale_60d',
            link: `/agencies`,
          },
        });
      }
    }
  }

  // 4. No follow-up task in 14 days after a visit
  private async noFollowupAlerts() {
    const cutoff = new Date(Date.now() - 14 * 86400000);
    const visits = await this.prisma.visitPlan.findMany({
      where: {
        status: 'done',
        planDate: { lt: cutoff },
        tasks: { none: { createdAt: { gte: cutoff } } },
      },
      include: {
        employee: { include: { user: true } },
        agency: { select: { name: true } },
      },
      take: 100,
    });

    for (const v of visits) {
      if (!v.employee.user?.id) continue;
      await this.prisma.inAppNotification.create({
        data: {
          userId: v.employee.user.id,
          title: '📝 ยังไม่มี Follow-up',
          body: `เยี่ยม ${v.agency.name} แล้ว 14 วัน ยังไม่มี follow-up`,
          type: 'no_followup_14d',
          link: `/visits/${v.id}`,
        },
      });
    }
  }

  // 5. Unconfirmed visits where plan_date = tomorrow
  private async unconfirmedVisitAlerts() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.toISOString().slice(0, 10));
    const dayAfter = new Date(tomorrowStart);
    dayAfter.setDate(tomorrowStart.getDate() + 1);

    const visits = await this.prisma.visitPlan.findMany({
      where: {
        status: 'waiting_confirmation',
        planDate: { gte: tomorrowStart, lt: dayAfter },
      },
      include: {
        employee: { include: { user: true } },
        agency: { select: { name: true, phone: true } },
      },
    });

    for (const v of visits) {
      if (!v.employee.user?.id) continue;
      await this.prisma.inAppNotification.create({
        data: {
          userId: v.employee.user.id,
          title: '📞 ต้องโทร Confirm นัดพรุ่งนี้',
          body: `โทรยืนยันนัด ${v.agency.name}${v.agency.phone ? ' (' + v.agency.phone + ')' : ''}`,
          type: 'confirm_reminder',
          link: `/visits/${v.id}`,
        },
      });
    }
  }
}
