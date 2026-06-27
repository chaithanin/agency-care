import {
  BadRequestException,
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@Controller('broadcasts')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  private readonly logger = new Logger(BroadcastController.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── Stats / Dashboard ────────────────────────────────────────
  @Get('stats')
  async stats() {
    const [total, draft, scheduled, sent, failed, all] = await Promise.all([
      this.db.broadcast.count(),
      this.db.broadcast.count({ where: { status: 'draft' } }),
      this.db.broadcast.count({ where: { status: { in: ['scheduled', 'approved'] } } }),
      this.db.broadcast.count({ where: { status: 'sent' } }),
      this.db.broadcast.count({ where: { status: 'failed' } }),
      this.db.broadcast.findMany({ select: { sentCount: true, readCount: true } }),
    ]);
    const totalSent = all.reduce((s, b) => s + b.sentCount, 0);
    const totalRead = all.reduce((s, b) => s + b.readCount, 0);
    const avgReadRate = totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0;
    return { total, draft, scheduled, sent, failed, avgReadRate };
  }

  @Get('analytics')
  async analytics(@Query('days') days = '30') {
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    const broadcasts = await this.db.broadcast.findMany({
      where: { status: 'sent', sentAt: { gte: since } },
      select: { sentCount: true, deliveredCount: true, readCount: true, clickCount: true, failedCount: true, sentAt: true },
      orderBy: { sentAt: 'asc' },
    });
    const totalSent = broadcasts.reduce((s, b) => s + b.sentCount, 0);
    const totalRead = broadcasts.reduce((s, b) => s + b.readCount, 0);
    const totalClick = broadcasts.reduce((s, b) => s + b.clickCount, 0);
    return {
      totalSent,
      totalRead,
      totalClick,
      openRate: totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((totalClick / totalSent) * 100) : 0,
      series: broadcasts.map((b) => ({
        date: b.sentAt?.toISOString().slice(0, 10),
        sent: b.sentCount, read: b.readCount,
      })),
    };
  }

  // ─── Templates ────────────────────────────────────────────────
  @Get('templates')
  templates() {
    return this.db.broadcastTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('templates')
  createTemplate(@Body() body: any, @CurrentUser('id') userId: string) {
    return this.db.broadcastTemplate.create({
      data: { ...body, createdById: userId },
    });
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: any) {
    return this.db.broadcastTemplate.update({ where: { id }, data: body });
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.db.broadcastTemplate.update({ where: { id }, data: { isActive: false } });
  }

  // ─── CRUD ─────────────────────────────────────────────────────
  @Get()
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
    @Query('page') page = '1',
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (q) where.title = { contains: q, mode: 'insensitive' };
    const skip = (Number(page) - 1) * 20;
    return this.db.broadcast.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.db.broadcast.findUniqueOrThrow({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        recipients: {
          include: { employee: { select: { id: true, name: true, code: true } } },
          orderBy: { sentAt: 'desc' },
          take: 50,
        },
        logs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  @Post()
  async create(@Body() body: any, @CurrentUser('id') userId: string) {
    const broadcast = await this.db.broadcast.create({
      data: { ...body, createdById: userId, status: 'draft' },
    });
    await this.db.broadcastLog.create({
      data: { broadcastId: broadcast.id, action: 'created', userId, detail: broadcast.title },
    });
    return broadcast;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const broadcast = await this.db.broadcast.update({ where: { id }, data: body });
    await this.db.broadcastLog.create({
      data: { broadcastId: id, action: 'edited', userId },
    });
    return broadcast;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.db.broadcastLog.create({ data: { broadcastId: id, action: 'deleted', userId } });
    return this.db.broadcast.delete({ where: { id } });
  }

  // ─── Actions ──────────────────────────────────────────────────
  @Post(':id/approve')
  @Roles('admin', 'super_admin', 'closer')
  async approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const b = await this.db.broadcast.update({
      where: { id },
      data: { status: 'approved', approvedById: userId, approvedAt: new Date() },
    });
    await this.db.broadcastLog.create({ data: { broadcastId: id, action: 'approved', userId } });
    return b;
  }

  @Post(':id/reject')
  @Roles('admin', 'super_admin', 'closer')
  async reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser('id') userId: string) {
    const b = await this.db.broadcast.update({
      where: { id },
      data: { status: 'draft', rejectedReason: reason },
    });
    await this.db.broadcastLog.create({ data: { broadcastId: id, action: 'rejected', userId, detail: reason } });
    return b;
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const b = await this.db.broadcast.update({ where: { id }, data: { status: 'cancelled' } });
    await this.db.broadcastLog.create({ data: { broadcastId: id, action: 'cancelled', userId } });
    return b;
  }

  @Post(':id/send')
  async send(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const broadcast = await this.db.broadcast.findUniqueOrThrow({ where: { id } });
    if (!['draft', 'approved', 'scheduled', 'failed'].includes(broadcast.status)) {
      throw new BadRequestException(`ไม่สามารถส่งได้: สถานะปัจจุบันคือ "${broadcast.status}"`);
    }

    await this.db.broadcast.update({ where: { id }, data: { status: 'sending' } });

    // หา employees ที่ match recipientType
    const empWhere = this.buildEmployeeWhere(broadcast.recipientType, broadcast.recipientIds, broadcast.recipientFilter as any);
    const employees = await this.db.employee.findMany({
      where: { ...empWhere, lineUserId: { not: null } },
      select: { id: true, lineUserId: true, name: true },
    });

    const token = this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN', '');
    const message = this.buildLineMessage(broadcast);

    let sentCount = 0;
    let failedCount = 0;
    const batchSize = 500; // LINE multicast limit per call

    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      const lineUserIds = batch.map((e) => e.lineUserId!);
      try {
        if (token) {
          const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ to: lineUserIds, messages: [message] }),
          });
          if (!res.ok) {
            const err = await res.text();
            this.logger.error(`LINE multicast failed: ${err}`);
            failedCount += batch.length;
          } else {
            sentCount += batch.length;
          }
        } else {
          // ถ้าไม่มี token → simulate success (dev mode)
          sentCount += batch.length;
        }

        // บันทึก recipients
        await this.db.broadcastRecipient.createMany({
          data: batch.map((e) => ({
            broadcastId: id,
            employeeId: e.id,
            lineUserId: e.lineUserId!,
            status: token ? 'sent' : 'sent',
            sentAt: new Date(),
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        this.logger.error(`Send batch error: ${String(err)}`);
        failedCount += batch.length;
      }
    }

    const updatedBroadcast = await this.db.broadcast.update({
      where: { id },
      data: {
        status: sentCount > 0 ? 'sent' : 'failed',
        sentAt: new Date(),
        sentCount,
        failedCount,
        deliveredCount: sentCount,
      },
    });

    await this.db.broadcastLog.create({
      data: { broadcastId: id, action: 'sent', userId, detail: `ส่งสำเร็จ ${sentCount} ราย, ล้มเหลว ${failedCount} ราย` },
    });

    return { ok: true, sentCount, failedCount, status: updatedBroadcast.status };
  }

  // ─── Helpers ──────────────────────────────────────────────────
  private buildEmployeeWhere(
    recipientType: string,
    recipientIds: string[],
    filter?: { zone?: string; teamId?: string },
  ) {
    if (recipientType === 'individual' && recipientIds.length > 0) {
      return { id: { in: recipientIds } };
    }
    const where: any = {};
    if (recipientType === 'sale') where.user = { is: { activeRole: 'sales' } };
    else if (recipientType === 'closer') where.user = { is: { activeRole: 'closer' } };
    else if (recipientType === 'admin') where.user = { is: { activeRole: 'admin' } };
    if (filter?.zone) where.zone = filter.zone;
    if (filter?.teamId) where.teamId = filter.teamId;
    return where;
  }

  private buildLineMessage(broadcast: { title: string; content: string; imageUrl?: string | null; priority: string; type: string; buttons?: any }) {
    const priorityEmoji: Record<string, string> = {
      low: '🔵', normal: '📢', high: '🔴', critical: '🚨',
    };
    const emoji = priorityEmoji[broadcast.priority] ?? '📢';

    if (broadcast.imageUrl) {
      return {
        type: 'image',
        originalContentUrl: broadcast.imageUrl,
        previewImageUrl: broadcast.imageUrl,
      };
    }

    const text = `${emoji} ${broadcast.title}\n\n${broadcast.content}`;
    // ตัดไม่ให้เกิน 5000 chars (LINE limit)
    return { type: 'text', text: text.slice(0, 4999) };
  }
}
