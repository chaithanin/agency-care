import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STEP_ORDER = [
  'new_lead', 'assigned', 'qualification', 'contacted', 'appointment',
  'site_visit', 'evaluation', 'approval', 'agreement', 'onboarding',
  'training', 'marketing_support', 'first_sale', 'active_agency',
];

@Injectable()
export class AcquisitionService {
  constructor(private prisma: PrismaService) {}

  async list(query: { status?: string; assignedTo?: string; search?: string; from?: string; to?: string }) {
    const where: any = {};
    if (query.status && query.status !== 'all') where.status = query.status;
    if (query.assignedTo) where.assignedToId = query.assignedTo;
    if (query.search) {
      where.OR = [
        { agencyName: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to + 'T23:59:59');
    }
    return this.prisma.agencyLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true, code: true } },
        recordedBy: { select: { id: true, name: true } },
        _count: { select: { contacts: true, appointments: true, siteVisits: true } },
      },
    });
  }

  async create(userId: string, dto: any) {
    return this.prisma.agencyLead.create({
      data: {
        agencyName: dto.agencyName,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        province: dto.province,
        facebook: dto.facebook,
        website: dto.website,
        source: dto.source ?? 'walk_in',
        notes: dto.notes,
        recordedById: userId,
        assignedToId: dto.assignedToId || null,
        assignedAt: dto.assignedToId ? new Date() : null,
        status: dto.assignedToId ? 'assigned' : 'new_lead',
      },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.agencyLead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, code: true } },
        recordedBy: { select: { id: true, name: true } },
        contacts: { orderBy: { createdAt: 'desc' } },
        appointments: { orderBy: { apptDate: 'asc' } },
        siteVisits: { orderBy: { createdAt: 'desc' } },
        marketingItems: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.agencyLead.update({ where: { id }, data: dto });
  }

  async assign(id: string, employeeId: string) {
    await this.findOne(id);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        assignedToId: employeeId || null,
        assignedAt: employeeId ? new Date() : null,
        status: employeeId ? 'assigned' : 'new_lead',
      },
    });
  }

  async saveQualification(id: string, dto: any) {
    await this.findOne(id);
    const nextStatus = dto.result === 'qualified' ? 'qualification' : (dto.result === 'not_qualified' ? 'not_qualified' : 'qualification');
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        qualResult: dto.result,
        qualHasOffice: dto.hasOffice,
        qualAgentCount: dto.agentCount ? parseInt(dto.agentCount) : undefined,
        qualPropertyType: dto.propertyType,
        qualDoesMarketing: dto.doesMarketing,
        qualHasPotential: dto.hasPotential,
        qualServiceArea: dto.serviceArea,
        qualNotes: dto.notes,
        qualifiedAt: new Date(),
        status: nextStatus,
      },
    });
  }

  async addContact(id: string, dto: any) {
    await this.findOne(id);
    const [contact] = await this.prisma.$transaction([
      this.prisma.leadContact.create({
        data: {
          leadId: id,
          contactDate: new Date(dto.contactDate),
          result: dto.result,
          contactedBy: dto.contactedBy,
          notes: dto.notes,
        },
      }),
      this.prisma.agencyLead.update({
        where: { id },
        data: {
          status: dto.result === 'not_interested' ? 'not_qualified' : 'contacted',
        },
      }),
    ]);
    return contact;
  }

  async addAppointment(id: string, dto: any) {
    await this.findOne(id);
    const [appt] = await this.prisma.$transaction([
      this.prisma.leadAppointmentEntry.create({
        data: {
          leadId: id,
          type: dto.type,
          apptDate: new Date(dto.apptDate),
          location: dto.location,
          attendees: dto.attendees,
          notes: dto.notes,
        },
      }),
      this.prisma.agencyLead.update({ where: { id }, data: { status: 'appointment' } }),
    ]);
    return appt;
  }

  async addSiteVisit(id: string, dto: any) {
    await this.findOne(id);
    const [visit] = await this.prisma.$transaction([
      this.prisma.leadSiteVisit.create({
        data: {
          leadId: id,
          visitedAt: dto.visitedAt ? new Date(dto.visitedAt) : new Date(),
          latitude: dto.latitude ? parseFloat(dto.latitude) : undefined,
          longitude: dto.longitude ? parseFloat(dto.longitude) : undefined,
          report: dto.report,
          aiSummary: dto.aiSummary,
        },
      }),
      this.prisma.agencyLead.update({ where: { id }, data: { status: 'site_visit' } }),
    ]);
    return visit;
  }

  async saveEvaluation(id: string, dto: any) {
    await this.findOne(id);
    const scores = [dto.relationship, dto.businessPotential, dto.marketing,
      dto.location, dto.salesTeam, dto.financial, dto.competition].map(Number);
    const total = scores.reduce((a, b) => a + (b || 0), 0);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        evalRelationship: scores[0],
        evalBusinessPotential: scores[1],
        evalMarketing: scores[2],
        evalLocation: scores[3],
        evalSalesTeam: scores[4],
        evalFinancial: scores[5],
        evalCompetition: scores[6],
        evalTotalScore: total,
        evalNotes: dto.notes,
        evaluatedAt: new Date(),
        status: 'evaluation',
      },
    });
  }

  async saveApproval(id: string, userId: string, dto: any) {
    await this.findOne(id);
    const nextStatus = dto.decision === 'approved' ? 'agreement' : 'rejected';
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        approvalDecision: dto.decision,
        approvalNotes: dto.notes,
        approvedById: dto.decision === 'approved' ? userId : undefined,
        approvedAt: dto.decision === 'approved' ? new Date() : undefined,
        rejectReason: dto.rejectReason,
        status: nextStatus,
      },
    });
  }

  async saveAgreement(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        agreementNo: dto.agreementNo,
        agreementStart: dto.startDate ? new Date(dto.startDate) : undefined,
        agreementEnd: dto.endDate ? new Date(dto.endDate) : undefined,
        agreementUrl: dto.contractUrl,
        agreementSigned: dto.signed ?? false,
        status: 'onboarding',
      },
    });
  }

  async saveOnboarding(id: string, dto: any) {
    await this.findOne(id);
    const allDone = Object.values(dto.checklist ?? {}).every(Boolean);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        onboardingChecklist: dto.checklist,
        onboardingDoneAt: allDone ? new Date() : undefined,
        status: allDone ? 'training' : 'onboarding',
      },
    });
  }

  async saveTraining(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        trainingDate: dto.date ? new Date(dto.date) : undefined,
        trainingTopics: dto.topics,
        trainingTrainer: dto.trainer,
        trainingScore: dto.score ? parseInt(dto.score) : undefined,
        trainingCertified: dto.certified ?? false,
        status: 'marketing_support',
      },
    });
  }

  async addMarketingItem(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.leadMarketingItem.create({
      data: {
        leadId: id,
        type: dto.type,
        quantity: dto.quantity ? parseInt(dto.quantity) : undefined,
        notes: dto.notes,
        deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : undefined,
      },
    });
  }

  async recordFirstSale(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.agencyLead.update({
      where: { id },
      data: {
        firstSaleDate: dto.date ? new Date(dto.date) : new Date(),
        firstSaleProject: dto.project,
        firstSaleUnits: dto.units ? parseInt(dto.units) : undefined,
        firstSaleValue: dto.value ? parseFloat(dto.value) : undefined,
        status: 'active_agency',
      },
    });
  }

  async dashboard() {
    const all = await this.prisma.agencyLead.findMany({ select: { status: true, createdAt: true } });
    const byStatus: Record<string, number> = {};
    for (const s of STEP_ORDER) byStatus[s] = 0;
    byStatus['not_qualified'] = 0;
    byStatus['rejected'] = 0;
    for (const l of all) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

    const total = all.length;
    const active = byStatus['active_agency'] ?? 0;
    const convRate = total > 0 ? Math.round((active / total) * 100) : 0;

    // monthly new leads (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const recent = all.filter(l => l.createdAt >= sixMonthsAgo);
    const monthly: Record<string, number> = {};
    for (const l of recent) {
      const key = l.createdAt.toISOString().slice(0, 7);
      monthly[key] = (monthly[key] ?? 0) + 1;
    }

    return { total, active, convRate, byStatus, monthly };
  }

  async employees() {
    return this.prisma.employee.findMany({
      where: { isActive: true, position: 'sales' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateLeadStatus(id: string, newStatus: string) {
    const lead = await this.prisma.agencyLead.findUnique({ where: { id } });
    if (!lead) throw new Error('Lead not found');

    return this.prisma.agencyLead.update({
      where: { id },
      data: { status: newStatus },
      include: {
        assignedTo: true,
        recordedBy: true,
        contacts: true,
        appointments: true,
        siteVisits: true,
        marketingItems: true,
      },
    });
  }
}
