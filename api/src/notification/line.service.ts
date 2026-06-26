import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: object;
}

export interface LineTextMessage {
  type: 'text';
  text: string;
}

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private readonly baseUrl = 'https://api.line.me/v2/bot/message';

  constructor(private config: ConfigService) {}

  get token(): string {
    return this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
  }

  get enabled(): boolean {
    return !!this.token;
  }

  async pushText(lineUserId: string, text: string): Promise<boolean> {
    if (!this.enabled) return false;
    return this.push(lineUserId, { type: 'text', text });
  }

  async pushFlex(lineUserId: string, altText: string, contents: object): Promise<boolean> {
    if (!this.enabled) return false;
    return this.push(lineUserId, { type: 'flex', altText, contents });
  }

  private async push(lineUserId: string, message: object): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ to: lineUserId, messages: [message] }),
      });
      if (!res.ok) {
        this.logger.warn(`LINE push failed to ${lineUserId}: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LINE push failed to ${lineUserId}: ${msg}`);
      return false;
    }
  }

  // Build LINE Flex Bubble for sales daily brief
  buildSalesDailyBubble(params: {
    name: string;
    todayCount: number;
    overdueCount: number;
    completionPct: number;
    appUrl: string;
  }) {
    const { name, todayCount, overdueCount, completionPct, appUrl } = params;
    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: '📋 Daily Brief', weight: 'bold', color: '#ffffff', size: 'lg' }],
        backgroundColor: '#4F46E5', paddingAll: '16px',
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: `Good Morning, คุณ${name}`, weight: 'bold', size: 'md', color: '#111827' },
          { type: 'separator', margin: 'sm' },
          this._row('📅 งานวันนี้', `${todayCount} งาน`, '#4F46E5'),
          this._row('⏳ งานค้าง', `${overdueCount} งาน`, overdueCount > 0 ? '#EF4444' : '#6B7280'),
          this._row('✅ ความสำเร็จ', `${completionPct}%`,
            completionPct >= 80 ? '#22C55E' : completionPct >= 50 ? '#F59E0B' : '#EF4444'),
        ],
      },
      footer: this._footer('👉 ดูรายละเอียด', appUrl),
    };
  }

  // Build LINE Flex Bubble for closer/team
  buildTeamBubble(params: {
    teamName: string;
    totalTasks: number;
    overdueTotal: number;
    members: { name: string; overdue: number }[];
    appUrl: string;
    isEvening?: boolean;
  }) {
    const { teamName, totalTasks, overdueTotal, members, appUrl, isEvening } = params;
    const header = isEvening ? '🚨 Evening Escalation' : '📊 Team Summary';
    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: header, weight: 'bold', color: '#ffffff', size: 'lg' }],
        backgroundColor: isEvening ? '#EF4444' : '#0369A1', paddingAll: '16px',
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: `ทีม: ${teamName}`, weight: 'bold', size: 'sm', color: '#374151' },
          this._row('📋 งานทั้งหมด', `${totalTasks} งาน`, '#374151'),
          this._row('⏳ งานค้าง', `${overdueTotal} งาน`, overdueTotal > 0 ? '#EF4444' : '#6B7280'),
          { type: 'separator', margin: 'sm' },
          ...members.slice(0, 5).map((m) =>
            this._row(`• ${m.name}`, `${m.overdue} งาน`, m.overdue > 0 ? '#EF4444' : '#6B7280'),
          ),
        ],
      },
      footer: this._footer('👉 ดู Dashboard', appUrl),
    };
  }

  // Build LINE Flex Bubble for executive
  buildExecutiveBubble(params: {
    totalTasks: number;
    completed: number;
    overdue: number;
    overdueEmployees: number;
    teams: { name: string; overdue: number }[];
    appUrl: string;
    isEvening?: boolean;
  }) {
    const { totalTasks, completed, overdue, overdueEmployees, teams, appUrl, isEvening } = params;
    const header = isEvening ? '🚨 Evening Executive Report' : '📈 Executive Summary';
    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: header, weight: 'bold', color: '#ffffff', size: 'lg' }],
        backgroundColor: isEvening ? '#7C3AED' : '#047857', paddingAll: '16px',
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          this._row('📋 งานทั้งหมด', `${totalTasks} งาน`, '#374151'),
          this._row('✅ เสร็จแล้ว', `${completed} งาน`, '#22C55E'),
          this._row('⏳ งานค้าง', `${overdue} งาน`, overdue > 0 ? '#EF4444' : '#6B7280'),
          this._row('👥 พนักงานมีงานค้าง', `${overdueEmployees} คน`, overdueEmployees > 0 ? '#EF4444' : '#6B7280'),
          { type: 'separator', margin: 'sm' },
          { type: 'text', text: 'แบ่งตามทีม:', size: 'xs', color: '#6B7280' },
          ...teams.slice(0, 5).map((t) =>
            this._row(`• ${t.name}`, `${t.overdue} งาน`, t.overdue > 0 ? '#EF4444' : '#6B7280'),
          ),
        ],
      },
      footer: this._footer('👉 Executive Dashboard', appUrl),
    };
  }

  // Build AI-enriched daily message (with task prioritization)
  buildAIDailyBubble(params: {
    name: string;
    todayCount: number;
    overdueCount: number;
    topTasks: { title: string; time?: string | null }[];
    appUrl: string;
  }) {
    const { name, todayCount, overdueCount, topTasks, appUrl } = params;
    return {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'text', text: '🤖 AI Daily Brief', weight: 'bold', color: '#ffffff', size: 'lg' }],
        backgroundColor: '#7C3AED', paddingAll: '16px',
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: `Good Morning, คุณ${name}`, weight: 'bold', size: 'md', color: '#111827' },
          this._row('📅 งานวันนี้', `${todayCount} งาน`, '#4F46E5'),
          overdueCount > 0
            ? this._row('⏳ งานค้าง', `${overdueCount} งาน`, '#EF4444')
            : null,
          { type: 'separator', margin: 'sm' },
          { type: 'text', text: '💡 AI แนะนำให้เริ่มจาก:', size: 'sm', weight: 'bold', color: '#374151' },
          ...topTasks.slice(0, 3).map((task, i) => ({
            type: 'text',
            text: `${i + 1}. ${task.title}${task.time ? ` (${task.time})` : ''}`,
            size: 'xs',
            color: '#4B5563',
            margin: 'xs',
          })),
        ].filter(Boolean) as object[],
      },
      footer: this._footer('👉 เปิด Dashboard', appUrl),
    };
  }

  private _row(label: string, value: string, color: string) {
    return {
      type: 'box', layout: 'horizontal', margin: 'xs',
      contents: [
        { type: 'text', text: label, size: 'sm', color: '#374151', flex: 4 },
        { type: 'text', text: value, size: 'sm', color, flex: 2, align: 'end', weight: 'bold' },
      ],
    };
  }

  private _footer(label: string, url: string) {
    return {
      type: 'box', layout: 'vertical',
      contents: [{
        type: 'button', style: 'primary', color: '#4F46E5', height: 'sm',
        action: { type: 'uri', label, uri: url },
      }],
      paddingAll: '12px',
    };
  }
}
