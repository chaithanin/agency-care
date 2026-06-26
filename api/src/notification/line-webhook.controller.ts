import { Controller, Post, Req, Res, HttpCode, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LineService } from './line.service';

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

@Controller('line')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly line: LineService,
  ) {}

  /** LINE Webhook endpoint — ลงทะเบียนที่ LINE Developers Console */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Res() res: Response) {
    // 1) Verify X-Line-Signature
    const secret = this.config.get<string>('LINE_CHANNEL_SECRET') ?? '';
    const signature = req.headers['x-line-signature'] as string;
    const rawBody: Buffer = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

    if (secret && signature) {
      const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
      try {
        const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!isValid) {
          this.logger.warn('LINE webhook signature mismatch');
          return res.status(403).json({ ok: false, message: 'Invalid signature' });
        }
      } catch {
        return res.status(403).json({ ok: false, message: 'Signature error' });
      }
    }

    // 2) Process events asynchronously — return 200 immediately
    const body = req.body as LineWebhookBody;
    setImmediate(() => this.processEvents(body.events ?? []).catch(e => this.logger.error(e)));

    return res.json({ ok: true });
  }

  private async processEvents(events: LineEvent[]) {
    for (const event of events) {
      try {
        await this.handleEvent(event);
      } catch (e) {
        this.logger.error(`Event handling failed: ${String(e)}`);
      }
    }
  }

  private async handleEvent(event: LineEvent) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) return;

    // Follow event — user adds the bot
    if (event.type === 'follow') {
      this.logger.log(`New follower: ${lineUserId}`);
      await this.replyText(event.replyToken, '👋 สวัสดีครับ! Agency Care พร้อมแจ้งเตือนคุณแล้ว\n\nส่ง "ผูก" เพื่อผูกบัญชีกับระบบ');
      return;
    }

    // Unfollow event
    if (event.type === 'unfollow') {
      // Remove lineUserId from employee
      await this.db.employee.updateMany({ where: { lineUserId }, data: { lineUserId: null } });
      return;
    }

    // Text message
    if (event.type === 'message' && event.message?.type === 'text') {
      const text = (event.message.text ?? '').trim().toLowerCase();

      if (text === 'ผูก' || text === 'bind' || text === 'link') {
        await this.replyText(event.replyToken, '🔗 เข้าสู่ระบบ Agency Care แล้วกด "ผูก LINE" ในหน้า Profile ของคุณครับ');
        return;
      }

      if (text === 'สถานะ' || text === 'status') {
        const emp = await this.db.employee.findFirst({ where: { lineUserId } });
        if (emp) {
          const today = new Date();
          const start = new Date(today.setHours(0,0,0,0));
          const end = new Date(today.setHours(23,59,59,999));
          const checkins = await this.db.visitCheckin.count({ where: { employeeId: emp.id, checkinAt: { gte: start, lte: end } } });
          const tasks = await this.db.task.count({ where: { assignedToId: emp.id, status: { not: 'done' } } });
          await this.replyText(event.replyToken, `📊 สถานะวันนี้\n\n✅ Check-in แล้ว: ${checkins} ครั้ง\n📋 งานค้าง: ${tasks} รายการ\n\nเปิดแอป: ${this.config.get('APP_URL') ?? 'https://agency-care-1027220843311.asia-east2.run.app'}`);
        } else {
          await this.replyText(event.replyToken, '❌ ยังไม่ได้ผูกบัญชี กรุณาเข้าระบบแล้วผูก LINE ก่อนครับ');
        }
        return;
      }

      if (text === 'help' || text === 'ช่วยเหลือ') {
        await this.replyText(event.replyToken,
          '🤖 Agency Care Bot\n\n' +
          '📌 คำสั่งที่ใช้ได้:\n' +
          '• สถานะ — ดูงานวันนี้\n' +
          '• ผูก — ผูกบัญชีกับระบบ\n' +
          '• help — ดูคำสั่งทั้งหมด\n\n' +
          '🔔 แจ้งเตือนอัตโนมัติ:\n' +
          '• 08:00 Daily Brief\n' +
          '• 12:00 Midday Reminder\n' +
          '• 16:00 Follow-up\n' +
          '• 18:00 Overdue Alert'
        );
        return;
      }

      // Default
      await this.replyText(event.replyToken, '🤖 พิมพ์ "help" เพื่อดูคำสั่งที่ใช้ได้ครับ');
    }

    // Postback (from Flex Message buttons)
    if (event.type === 'postback' && event.postback?.data) {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');

      if (action === 'status') {
        const emp = await this.db.employee.findFirst({ where: { lineUserId } });
        if (emp) {
          await this.replyText(event.replyToken, `📊 เปิดแอปเพื่อดูรายละเอียด: ${this.config.get('APP_URL') ?? 'https://agency-care-1027220843311.asia-east2.run.app'}`);
        }
      }
    }
  }

  private async replyText(replyToken: string | undefined, text: string) {
    if (!replyToken) return;
    const token = this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
    if (!token) return;
    try {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
      });
    } catch (e) {
      this.logger.error(`Reply failed: ${String(e)}`);
    }
  }
}
