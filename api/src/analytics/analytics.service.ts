import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';

export interface Insight {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

const DAY = 86400000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // รวบรวมสถิติดิบสำหรับให้ AI วิเคราะห์
  private async gatherStats() {
    const now = Date.now();
    const cut30 = new Date(now - 30 * DAY);
    const cut60 = new Date(now - 60 * DAY);
    const cut90 = new Date(now - 90 * DAY);

    const [employees, assignments, doneVisits, sales] = await Promise.all([
      this.prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      this.prisma.agencyAssignment.findMany({
        where: { isActive: true },
        select: { employeeId: true, agencyId: true, agency: { select: { name: true } } },
      }),
      this.prisma.visitPlan.findMany({
        where: { status: 'done', planDate: { gte: cut90 } },
        select: { employeeId: true, agencyId: true, planDate: true },
      }),
      this.prisma.salesActivity.findMany({
        where: { createdAt: { gte: cut60 } },
        select: { amount: true, createdAt: true, visitPlan: { select: { agencyId: true } } },
      }),
    ]);

    // ภาระงานต่อเซลส์
    const empName = new Map(employees.map((e) => [e.id, e.name]));
    const assignCount = new Map<string, number>();
    assignments.forEach((a) => assignCount.set(a.employeeId, (assignCount.get(a.employeeId) ?? 0) + 1));
    const done30 = new Map<string, number>();
    doneVisits
      .filter((v) => v.planDate >= cut30)
      .forEach((v) => done30.set(v.employeeId, (done30.get(v.employeeId) ?? 0) + 1));
    const perEmployee = employees.map((e) => ({
      name: e.name,
      assignedAgencies: assignCount.get(e.id) ?? 0,
      visitsDoneLast30: done30.get(e.id) ?? 0,
    }));

    // Agency ที่ขาดการเยี่ยมนาน
    const lastVisit = new Map<string, Date>();
    doneVisits.forEach((v) => {
      const cur = lastVisit.get(v.agencyId);
      if (!cur || v.planDate > cur) lastVisit.set(v.agencyId, v.planDate);
    });
    const agencyName = new Map(assignments.map((a) => [a.agencyId, a.agency.name]));
    const staleAgencies = [...agencyName.entries()]
      .map(([agencyId, name]) => {
        const last = lastVisit.get(agencyId);
        const days = last ? Math.round((now - last.getTime()) / DAY) : 999;
        return { name, daysSinceVisit: days };
      })
      .filter((x) => x.daysSinceVisit >= 45)
      .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)
      .slice(0, 20);

    // ยอดขายตก (30 วันล่าสุด vs 30 วันก่อนหน้า)
    const salesNow = new Map<string, number>();
    const salesPrev = new Map<string, number>();
    sales.forEach((s) => {
      const aid = s.visitPlan.agencyId;
      if (s.createdAt >= cut30) salesNow.set(aid, (salesNow.get(aid) ?? 0) + s.amount);
      else salesPrev.set(aid, (salesPrev.get(aid) ?? 0) + s.amount);
    });
    const salesDrops = [...salesPrev.entries()]
      .map(([aid, prev]) => {
        const cur = salesNow.get(aid) ?? 0;
        const dropPct = prev > 0 ? Math.round(((prev - cur) / prev) * 100) : 0;
        return { name: agencyName.get(aid) ?? aid, prev, current: cur, dropPct };
      })
      .filter((x) => x.dropPct >= 20)
      .sort((a, b) => b.dropPct - a.dropPct)
      .slice(0, 20);

    return {
      totals: {
        activeEmployees: employees.length,
        activeAssignments: assignments.length,
        visitsDoneLast30: doneVisits.filter((v) => v.planDate >= cut30).length,
      },
      perEmployee,
      staleAgencies,
      salesDrops,
    };
  }

  async analyze(): Promise<{ generatedAt: string; insights: Insight[]; raw?: unknown }> {
    const stats = await this.gatherStats();
    const provider = (this.config.get<string>('ANALYTICS_PROVIDER') || 'gemini').toLowerCase();
    const system =
      'คุณเป็นนักวิเคราะห์ทีมขายภาคสนาม วิเคราะห์ข้อมูลที่ให้และสรุปเป็น insight ภาษาไทยที่นำไปใช้จริงได้ ' +
      '5-8 ข้อ จัดลำดับความสำคัญ ระบุปัญหาเชิงตัวเลขชัดเจน (เช่น "Agency X ยอดตก 32%") พร้อมข้อเสนอแนะที่ทำได้ทันที';
    const prompt = `ข้อมูลสรุปทีมขาย (JSON):\n${JSON.stringify(stats, null, 2)}\n\nวิเคราะห์และสร้าง insights`;

    try {
      const insights =
        provider === 'claude'
          ? await this.callClaude(system, prompt)
          : await this.callGemini(system, prompt);
      if (insights === null) {
        return {
          generatedAt: new Date().toISOString(),
          insights: [
            {
              title: `ยังไม่ได้ตั้งค่า API key ของ ${provider}`,
              detail:
                'ใส่ GEMINI_API_KEY (จาก aistudio.google.com) หรือ ANTHROPIC_API_KEY ใน .env — ด้านล่างคือสถิติดิบ',
              severity: 'low',
              recommendation: 'ตั้งค่าคีย์แล้วลองอีกครั้ง',
            },
          ],
          raw: stats,
        };
      }
      return { generatedAt: new Date().toISOString(), insights };
    } catch (e) {
      this.logger.error(`AI วิเคราะห์ล้มเหลว (${provider}): ${(e as Error).message}`);
      return {
        generatedAt: new Date().toISOString(),
        insights: [
          {
            title: 'วิเคราะห์ด้วย AI ไม่สำเร็จ',
            detail: (e as Error).message,
            severity: 'medium',
            recommendation: 'ตรวจสอบ API key / โควต้า แล้วลองใหม่',
          },
        ],
        raw: stats,
      };
    }
  }

  // ---- Gemini — รองรับ 2 โหมด ----
  // 1) Vertex AI (GEMINI_VERTEX=true) ใช้ ADC + region ของ project → ไม่โดน block ภูมิภาค (เช่น Cloud Run ฮ่องกง)
  // 2) AI Studio API key (GEMINI_API_KEY) — ใช้นอก GCP / dev
  private async callGemini(system: string, prompt: string): Promise<Insight[] | null> {
    const model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    let ai: GoogleGenAI;
    if (this.config.get('GEMINI_VERTEX') === 'true') {
      ai = new GoogleGenAI({
        vertexai: true,
        project: this.config.get<string>('GCP_PROJECT') || this.config.get<string>('GOOGLE_CLOUD_PROJECT'),
        location: this.config.get<string>('VERTEX_LOCATION') || 'asia-southeast1',
      });
    } else {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) return null;
      ai = new GoogleGenAI({ apiKey });
    }
    const res = await ai.models.generateContent({
      model,
      contents: `${prompt}\n\nตอบเป็น JSON เท่านั้น รูปแบบ: {"insights":[{"title":"","detail":"","severity":"high|medium|low","recommendation":""}]}`,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
      },
    });
    const parsed = JSON.parse(res.text ?? '{"insights":[]}');
    return parsed.insights ?? [];
  }

  // ---- Claude (คีย์จาก console.anthropic.com) ----
  private async callClaude(system: string, prompt: string): Promise<Insight[] | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return null;
    const client = new Anthropic({ apiKey });
    const schema = {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              recommendation: { type: 'string' },
            },
            required: ['title', 'detail', 'severity', 'recommendation'],
            additionalProperties: false,
          },
        },
      },
      required: ['insights'],
      additionalProperties: false,
    };
    // output_config / thinking ส่งผ่าน body ไป API (รองรับใน claude-opus-4-8)
    const params: Record<string, unknown> = {
      model: 'claude-opus-4-8',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      system,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    };
    const response = await client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );
    const textBlock = response.content.find((b) => b.type === 'text');
    const parsed =
      textBlock && 'text' in textBlock ? JSON.parse(textBlock.text) : { insights: [] };
    return parsed.insights ?? [];
  }
}
