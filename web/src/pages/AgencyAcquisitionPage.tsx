import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Tab, Tabs, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, Card, CardContent, Stack, IconButton,
  Drawer, Stepper, Step, StepButton, FormControlLabel, Checkbox,
  Slider, Alert, CircularProgress, Paper, Snackbar,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsIcon from '@mui/icons-material/Groups';
import HandshakeIcon from '@mui/icons-material/Handshake';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { api } from '../api/client';
import { ExportPdfButton } from '../components/ExportPdfButton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTip,
  FunnelChart, Funnel, LabelList, ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────
interface Lead {
  id: string;
  agencyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  province?: string;
  facebook?: string;
  website?: string;
  source: string;
  notes?: string;
  status: string;
  assignedToId?: string;
  assignedTo?: { id: string; name: string; code: string };
  recordedBy?: { id: string; name: string };
  qualResult?: string;
  evalTotalScore?: number;
  approvalDecision?: string;
  agreementSigned?: boolean;
  agreementUrl?: string;
  trainingCertified?: boolean;
  firstSaleDate?: string;
  isDuplicate?: boolean;
  createdAt: string;
  contacts?: ContactEntry[];
  appointments?: ApptEntry[];
  siteVisits?: SiteVisitEntry[];
  marketingItems?: MarketingEntry[];
  onboardingChecklist?: Record<string, boolean>;
  qualHasOffice?: boolean;
  qualAgentCount?: number;
  qualPropertyType?: string;
  qualDoesMarketing?: boolean;
  qualHasPotential?: boolean;
  qualServiceArea?: string;
  qualNotes?: string;
  evalRelationship?: number;
  evalBusinessPotential?: number;
  evalMarketing?: number;
  evalLocation?: number;
  evalSalesTeam?: number;
  evalFinancial?: number;
  evalCompetition?: number;
  evalNotes?: string;
  approvalNotes?: string;
  rejectReason?: string;
  agreementNo?: string;
  agreementStart?: string;
  agreementEnd?: string;
  trainingDate?: string;
  trainingTopics?: string;
  trainingTrainer?: string;
  trainingScore?: number;
  firstSaleProject?: string;
  firstSaleUnits?: number;
  firstSaleValue?: number;
}
interface ContactEntry { id: string; contactDate: string; result: string; contactedBy?: string; notes?: string; }
interface ApptEntry { id: string; type: string; apptDate: string; location?: string; attendees?: string; notes?: string; }
interface SiteVisitEntry { id: string; visitedAt?: string; report?: string; }
interface MarketingEntry { id: string; type: string; quantity?: number; notes?: string; deliveredAt?: string; }
interface Employee { id: string; name: string; code: string; }
interface DashData {
  total: number; active: number; convRate: number;
  byStatus: Record<string, number>;
  monthly: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────
const STEPS = [
  { key: 'new_lead', label: 'New Lead', stepIdx: 0 },
  { key: 'assigned', label: 'Assign Sale', stepIdx: 1 },
  { key: 'qualification', label: 'Qualification', stepIdx: 2 },
  { key: 'contacted', label: 'First Contact', stepIdx: 3 },
  { key: 'appointment', label: 'Appointment', stepIdx: 4 },
  { key: 'site_visit', label: 'Site Visit', stepIdx: 5 },
  { key: 'evaluation', label: 'Evaluation', stepIdx: 6 },
  { key: 'approval', label: 'Approval', stepIdx: 7 },
  { key: 'agreement', label: 'Agreement', stepIdx: 8 },
  { key: 'onboarding', label: 'Onboarding', stepIdx: 9 },
  { key: 'training', label: 'Training', stepIdx: 10 },
  { key: 'marketing_support', label: 'Marketing', stepIdx: 11 },
  { key: 'first_sale', label: 'First Sale', stepIdx: 12 },
  { key: 'active_agency', label: 'Active!', stepIdx: 13 },
];
const TERMINAL = ['not_qualified', 'rejected'];

const STATUS_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'> = {
  new_lead: 'default', assigned: 'info', qualification: 'info',
  contacted: 'info', appointment: 'primary', site_visit: 'primary',
  evaluation: 'warning', approval: 'warning', agreement: 'warning',
  onboarding: 'secondary', training: 'secondary', marketing_support: 'secondary',
  first_sale: 'success', active_agency: 'success',
  not_qualified: 'error', rejected: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  new_lead: 'New Lead', assigned: 'Assigned', qualification: 'Qualification',
  contacted: 'Contacted', appointment: 'Appointment', site_visit: 'Site Visit',
  evaluation: 'Evaluation', approval: 'Approval', agreement: 'Agreement',
  onboarding: 'Onboarding', training: 'Training', marketing_support: 'Marketing',
  first_sale: 'First Sale', active_agency: 'Active Agency',
  not_qualified: 'Not Qualified', rejected: 'Rejected',
};

const SOURCES = ['Walk-in', 'Referral', 'Facebook', 'Event', 'Website', 'LINE', 'Other'];
const CONTACT_RESULTS = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'call_later', label: 'Call Back Later' },
];
const APPT_TYPES = [
  { value: 'visit_agency', label: 'Visit Agency Office' },
  { value: 'visit_showroom', label: 'Visit Showroom' },
  { value: 'online_meeting', label: 'Online Meeting' },
];
const MARKETING_TYPES = ['Brochure', 'Standee', 'Banner', 'Facebook Ads', 'Project Info', 'Gift'];
const ONBOARDING_ITEMS = [
  { key: 'addedToSystem', label: 'Added to System' },
  { key: 'sentPriceList', label: 'Sent Price List' },
  { key: 'sentBrochure', label: 'Sent Brochure' },
  { key: 'sentPromotion', label: 'Sent Promotion' },
  { key: 'sentBanner', label: 'Sent Banner' },
  { key: 'sentMediaKit', label: 'Sent Media Kit' },
  { key: 'addedLineOA', label: 'Added LINE OA' },
  { key: 'addedLineGroup', label: 'Added to LINE Group' },
  { key: 'addedEmail', label: 'Added Email' },
];
const EVAL_FIELDS = [
  { key: 'relationship', label: 'Relationship' },
  { key: 'businessPotential', label: 'Business Potential' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'location', label: 'Location' },
  { key: 'salesTeam', label: 'Sales Team' },
  { key: 'financial', label: 'Financial' },
  { key: 'competition', label: 'Competition' },
];

function stepIdxOf(status: string) {
  return STEPS.find(s => s.key === status)?.stepIdx ?? 0;
}

function fmtDate(d?: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Pipeline Columns ─────────────────────────────────────────
const PIPELINE_COLS = [
  { id: 'col-new-lead', label: 'New Lead', statuses: ['new_lead'], color: '#607d8b' },
  { id: 'col-in-progress', label: 'In Progress', statuses: ['assigned', 'qualification', 'contacted', 'appointment'], color: '#1565c0' },
  { id: 'col-visit-eval', label: 'Visit & Eval', statuses: ['site_visit', 'evaluation'], color: '#6a1b9a' },
  { id: 'col-closing', label: 'Closing', statuses: ['approval', 'agreement'], color: '#e65100' },
  { id: 'col-onboarding', label: 'Onboarding', statuses: ['onboarding', 'training', 'marketing_support'], color: '#00695c' },
  { id: 'col-active', label: 'Active', statuses: ['first_sale', 'active_agency'], color: '#2e7d32' },
  { id: 'col-closed', label: 'Closed', statuses: ['not_qualified', 'rejected'], color: '#b71c1c' },
];

// ── Main Page ─────────────────────────────────────────────────
export default function AgencyAcquisitionPage() {
  const [tab, setTab] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<DashData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, dashRes, empRes] = await Promise.all([
        api.get('/acquisition/leads'),
        api.get('/acquisition/leads/dashboard'),
        api.get('/acquisition/leads/employees'),
      ]);
      setLeads(leadsRes.data);
      setDash(dashRes.data);
      setEmployees(empRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLead = async (lead: Lead) => {
    const res = await api.get(`/acquisition/leads/${lead.id}`);
    setSelected(res.data);
    setActiveStep(stepIdxOf(res.data.status));
    setDrawerOpen(true);
  };

  const filteredLeads = leads.filter(l => {
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchSearch = !search || l.agencyName.toLowerCase().includes(search.toLowerCase())
      || l.contactPerson.toLowerCase().includes(search.toLowerCase())
      || l.phone.includes(search);
    return matchStatus && matchSearch;
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Agency Acquisition Workflow</Typography>
          <Typography variant="body2" color="text.secondary">Track new leads from initial contact through to Active Agency</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          + New Lead
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="📊 Dashboard" />
        <Tab label="📋 Pipeline" />
        <Tab label="📝 List" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', height: 200 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* ── Dashboard Tab ── */}
          <Box hidden={tab !== 0}>
            <DashboardView dash={dash} />
          </Box>

          {/* ── Pipeline Tab ── */}
          <Box hidden={tab !== 1}>
            <PipelineView leads={leads} onSelect={openLead} onRefresh={load} />
          </Box>

          {/* ── List Tab ── */}
          <Box hidden={tab !== 2}>
            <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap" alignItems="center">
              <TextField
                size="small" placeholder="Search Agency / Name / Phone"
                value={search} onChange={e => setSearch(e.target.value)}
                sx={{ width: 260 }}
              />
              <TextField select size="small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="all">All Statuses</MenuItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </TextField>
              <ExportPdfButton
                tableId="acquisition-table"
                filename="agency-acquisition"
                title="Agency Acquisition"
                size="small"
                variant="outlined"
              />
              <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                {filteredLeads.length} records
              </Typography>
            </Stack>
            <ListView leads={filteredLeads} onSelect={openLead} />
          </Box>
        </>
      )}

      {/* Create Dialog */}
      <CreateLeadDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} employees={employees} />

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100vw', md: 720 }, display: 'flex', flexDirection: 'column' } }}
      >
        {selected && (
          <LeadDetailDrawer
            lead={selected}
            employees={employees}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onClose={() => setDrawerOpen(false)}
            onRefresh={async () => {
              const res = await api.get(`/acquisition/leads/${selected.id}`);
              setSelected(res.data);
              setActiveStep(stepIdxOf(res.data.status));
              load();
            }}
          />
        )}
      </Drawer>
    </Box>
  );
}

// ── Dashboard View ────────────────────────────────────────────
function DashboardView({ dash }: { dash: DashData | null }) {
  if (!dash) return null;
  const funnelData = [
    { name: 'Total Leads', value: dash.total, fill: '#607d8b' },
    { name: 'Qualified', value: (dash.byStatus['qualification'] ?? 0) + (dash.byStatus['contacted'] ?? 0) + (dash.byStatus['appointment'] ?? 0) + (dash.byStatus['site_visit'] ?? 0) + (dash.byStatus['evaluation'] ?? 0) + (dash.byStatus['approval'] ?? 0) + (dash.byStatus['agreement'] ?? 0) + (dash.byStatus['onboarding'] ?? 0) + (dash.byStatus['training'] ?? 0) + (dash.byStatus['marketing_support'] ?? 0) + (dash.byStatus['first_sale'] ?? 0) + (dash.byStatus['active_agency'] ?? 0), fill: '#1565c0' },
    { name: 'Site Visit', value: (dash.byStatus['site_visit'] ?? 0) + (dash.byStatus['evaluation'] ?? 0) + (dash.byStatus['approval'] ?? 0) + (dash.byStatus['agreement'] ?? 0) + (dash.byStatus['onboarding'] ?? 0) + (dash.byStatus['training'] ?? 0) + (dash.byStatus['marketing_support'] ?? 0) + (dash.byStatus['first_sale'] ?? 0) + (dash.byStatus['active_agency'] ?? 0), fill: '#6a1b9a' },
    { name: 'Agreement', value: (dash.byStatus['agreement'] ?? 0) + (dash.byStatus['onboarding'] ?? 0) + (dash.byStatus['training'] ?? 0) + (dash.byStatus['marketing_support'] ?? 0) + (dash.byStatus['first_sale'] ?? 0) + (dash.byStatus['active_agency'] ?? 0), fill: '#e65100' },
    { name: 'Active Agency', value: dash.byStatus['active_agency'] ?? 0, fill: '#2e7d32' },
  ].filter(d => d.value > 0);

  const monthlyArr = Object.entries(dash.monthly).sort().map(([k, v]) => ({
    month: k.slice(5), count: v,
  }));

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'Total Leads', value: dash.total, icon: <GroupsIcon />, color: '#1565c0' },
          { label: 'Active Agency', value: dash.active, icon: <StorefrontIcon />, color: '#2e7d32' },
          { label: 'Conversion Rate', value: `${dash.convRate}%`, icon: <TrendingUpIcon />, color: '#e65100' },
          { label: 'In Pipeline', value: dash.total - (dash.byStatus['active_agency'] ?? 0) - (dash.byStatus['not_qualified'] ?? 0) - (dash.byStatus['rejected'] ?? 0), icon: <HandshakeIcon />, color: '#6a1b9a' },
        ].map(k => (
          <Grid item xs={6} md={3} key={k.label}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Box sx={{ color: k.color, mb: 0.5 }}>{k.icon}</Box>
                <Typography variant="h4" fontWeight={800} sx={{ color: k.color }}>{k.value}</Typography>
                <Typography variant="body2" color="text.secondary">{k.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} mb={1}>Conversion Funnel</Typography>
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <FunnelChart>
                    <ReTip />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} mb={1}>New Leads per Month</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyArr} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ReTip />
                  <Bar dataKey="count" name="Lead" fill="#1565c0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={700} mb={1.5}>Current Status</Typography>
              <Stack spacing={0.75}>
                {Object.entries(dash.byStatus).filter(([, v]) => v > 0).map(([k, v]) => (
                  <Stack key={k} direction="row" justifyContent="space-between" alignItems="center">
                    <Chip label={STATUS_LABEL[k] ?? k} size="small" color={STATUS_COLOR[k] ?? 'default'} sx={{ fontSize: 11 }} />
                    <Typography fontWeight={700}>{v}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

// ── Pipeline View ─────────────────────────────────────────────
function PipelineView({ leads, onSelect, onRefresh }: { leads: Lead[]; onSelect: (l: Lead) => void; onRefresh: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    const targetCol = PIPELINE_COLS.find(c => c.id === destination.droppableId);
    if (!targetCol) return;

    const newStatus = targetCol.statuses[0];
    setDragging(true);

    try {
      await api.patch(`/acquisition/leads/${lead.id}/status`, { newStatus });
      setToastMsg(`Moved "${lead.agencyName}" to ${targetCol.label}`);
      onRefresh();
    } catch (err) {
      setToastMsg(`Failed to update status: ${err}`);
    } finally {
      setDragging(false);
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
          {PIPELINE_COLS.map(col => {
            const colLeads = leads.filter(l => col.statuses.includes(l.status));
            return (
              <Droppable key={col.id} droppableId={col.id}>
                {(provided, snapshot) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    sx={{
                      minWidth: 220,
                      flexShrink: 0,
                      bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <Box sx={{ bgcolor: col.color, color: '#fff', px: 1.5, py: 0.75, borderRadius: '8px 8px 0 0' }}>
                      <Typography fontWeight={700} fontSize={13}>{col.label}</Typography>
                      <Typography fontSize={12} sx={{ opacity: 0.85 }}>{colLeads.length} records</Typography>
                    </Box>
                    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderTop: 'none', borderColor: 'divider', borderRadius: '0 0 8px 8px', minHeight: 80, maxHeight: 600, overflowY: 'auto', p: 0.75 }}>
                      {colLeads.map((lead, idx) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              variant="outlined"
                              onClick={() => onSelect(lead)}
                              sx={{
                                mb: 0.75,
                                cursor: dragging ? 'grabbing' : 'grab',
                                opacity: snapshot.isDragging ? 0.5 : 1,
                                transform: snapshot.isDragging ? 'rotate(2deg)' : 'rotate(0deg)',
                                boxShadow: snapshot.isDragging ? 3 : 0,
                                '&:hover': { boxShadow: 2, borderColor: col.color },
                                transition: 'all 0.2s',
                              }}
                            >
                              <CardContent sx={{ py: '8px !important', px: 1.5 }}>
                                <Typography fontWeight={700} fontSize={13} noWrap>{lead.agencyName}</Typography>
                                <Typography fontSize={12} color="text.secondary" noWrap>{lead.contactPerson} · {lead.phone}</Typography>
                                {lead.province && <Typography fontSize={11} color="text.secondary">{lead.province}</Typography>}
                                <Stack direction="row" spacing={0.5} mt={0.5} alignItems="center">
                                  <Chip label={STATUS_LABEL[lead.status]} size="small" color={STATUS_COLOR[lead.status] ?? 'default'} sx={{ fontSize: 10, height: 18 }} />
                                  {lead.assignedTo && <Typography fontSize={11} color="text.secondary">{lead.assignedTo.name}</Typography>}
                                </Stack>
                                <Typography fontSize={11} color="text.disabled" mt={0.25}>{fmtDate(lead.createdAt)}</Typography>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {colLeads.length === 0 && (
                        <Typography fontSize={12} color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>Empty</Typography>
                      )}
                      {provided.placeholder}
                    </Box>
                  </Box>
                )}
              </Droppable>
            );
          })}
        </Box>
      </DragDropContext>
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={3000}
        onClose={() => setToastMsg('')}
        message={toastMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </>
  );
}

// ── List View ─────────────────────────────────────────────────
function ListView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  return (
    <Box id="acquisition-table">
      {leads.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>No data</Typography>
      )}
      <Stack spacing={1}>
        {leads.map(lead => (
          <Card
            key={lead.id}
            variant="outlined"
            onClick={() => onSelect(lead)}
            sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
          >
            <CardContent sx={{ py: '10px !important' }}>
              <Grid container alignItems="center" spacing={1}>
                <Grid item xs={12} sm={4}>
                  <Typography fontWeight={700}>{lead.agencyName}</Typography>
                  <Typography variant="body2" color="text.secondary">{lead.contactPerson} · {lead.phone}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" color="text.secondary">Province</Typography>
                  <Typography variant="body2">{lead.province || '-'}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" color="text.secondary">Source</Typography>
                  <Typography variant="body2">{lead.source}</Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Chip label={STATUS_LABEL[lead.status] ?? lead.status} size="small" color={STATUS_COLOR[lead.status] ?? 'default'} />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="caption" color="text.secondary">Sale</Typography>
                  <Typography variant="body2">{lead.assignedTo?.name || '-'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

// ── Create Lead Dialog ────────────────────────────────────────
function CreateLeadDialog({ open, onClose, onCreated, employees = [] }: { open: boolean; onClose: () => void; onCreated: () => void; employees?: Employee[] }) {
  const init = { agencyName: '', contactPerson: '', phone: '', email: '', province: '', facebook: '', website: '', source: 'Walk-in', notes: '', assignedToId: '' };
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.agencyName || !form.contactPerson || !form.phone) return;
    setSaving(true);
    try {
      await api.post('/acquisition/leads', form);
      onCreated();
      onClose();
      setForm(init);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>+ New Lead</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}><TextField label="Agency Name *" fullWidth size="small" value={form.agencyName} onChange={set('agencyName')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Contact Person *" fullWidth size="small" value={form.contactPerson} onChange={set('contactPerson')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Phone *" fullWidth size="small" value={form.phone} onChange={set('phone')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Email" fullWidth size="small" value={form.email} onChange={set('email')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Province" fullWidth size="small" value={form.province} onChange={set('province')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Facebook" fullWidth size="small" value={form.facebook} onChange={set('facebook')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Website" fullWidth size="small" value={form.website} onChange={set('website')} /></Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Source" fullWidth size="small" value={form.source} onChange={set('source')}>
              {SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Assign to (Optional)" fullWidth size="small" value={form.assignedToId} onChange={set('assignedToId')}>
              <MenuItem value="">— None —</MenuItem>
              {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}><TextField label="Notes" fullWidth size="small" multiline rows={2} value={form.notes} onChange={set('notes')} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !form.agencyName || !form.contactPerson || !form.phone}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Lead Detail Drawer ────────────────────────────────────────
function LeadDetailDrawer({ lead, employees, activeStep, setActiveStep, onClose, onRefresh }: {
  lead: Lead; employees: Employee[]; activeStep: number; setActiveStep: (n: number) => void;
  onClose: () => void; onRefresh: () => void;
}) {
  const currentStepIdx = stepIdxOf(lead.status);
  const isTerminal = TERMINAL.includes(lead.status);

  return (
    <>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700}>{lead.agencyName}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip label={STATUS_LABEL[lead.status] ?? lead.status} size="small" color={STATUS_COLOR[lead.status] ?? 'default'} />
              {lead.isDuplicate && <Chip label="⚠️ Duplicate" size="small" color="warning" />}
              <Typography variant="caption" color="text.secondary">{lead.contactPerson} · {lead.phone}</Typography>
            </Stack>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </Box>

      {/* Stepper */}
      <Box sx={{ px: 1, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', overflowX: 'auto', flexShrink: 0 }}>
        <Stepper activeStep={currentStepIdx} alternativeLabel nonLinear sx={{ minWidth: 900 }}>
          {STEPS.map((s, i) => (
            <Step key={s.key} completed={i < currentStepIdx}>
              <StepButton onClick={() => setActiveStep(i)}>
                <Typography fontSize={10} noWrap>{s.label}</Typography>
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {isTerminal && (
          <Alert severity={lead.status === 'not_qualified' ? 'warning' : 'error'} sx={{ mb: 2 }}>
            {lead.status === 'not_qualified' ? 'This lead did not pass Qualification' : `This lead was Rejected — ${lead.rejectReason || ''}`}
          </Alert>
        )}

        {activeStep === 0 && <StepLeadInfo lead={lead} onRefresh={onRefresh} />}
        {activeStep === 1 && <StepAssign lead={lead} employees={employees} onRefresh={onRefresh} />}
        {activeStep === 2 && <StepQualification lead={lead} onRefresh={onRefresh} />}
        {activeStep === 3 && <StepContact lead={lead} onRefresh={onRefresh} />}
        {activeStep === 4 && <StepAppointment lead={lead} onRefresh={onRefresh} />}
        {activeStep === 5 && <StepSiteVisit lead={lead} onRefresh={onRefresh} />}
        {activeStep === 6 && <StepEvaluation lead={lead} onRefresh={onRefresh} />}
        {activeStep === 7 && <StepApproval lead={lead} onRefresh={onRefresh} />}
        {activeStep === 8 && <StepAgreement lead={lead} onRefresh={onRefresh} />}
        {activeStep === 9 && <StepOnboarding lead={lead} onRefresh={onRefresh} />}
        {activeStep === 10 && <StepTraining lead={lead} onRefresh={onRefresh} />}
        {activeStep === 11 && <StepMarketing lead={lead} onRefresh={onRefresh} />}
        {activeStep === 12 && <StepFirstSale lead={lead} onRefresh={onRefresh} />}
        {activeStep === 13 && <StepActiveAgency lead={lead} />}
      </Box>
    </>
  );
}

// ── Step Components ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={2.5}>
      <Typography variant="subtitle2" fontWeight={700} color="primary" mb={1}>{title}</Typography>
      {children}
    </Box>
  );
}

function SaveBtn({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button variant="contained" onClick={onClick} disabled={saving} sx={{ mt: 1.5 }}>
      {saving ? 'Saving...' : 'Save & Continue →'}
    </Button>
  );
}

// Step 1
function StepLeadInfo({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    agencyName: lead.agencyName, contactPerson: lead.contactPerson, phone: lead.phone,
    email: lead.email ?? '', province: lead.province ?? '', facebook: lead.facebook ?? '',
    website: lead.website ?? '', source: lead.source, notes: lead.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}`, form); onRefresh(); setEdit(false); }
    finally { setSaving(false); }
  };

  if (!edit) return (
    <Box>
      <Section title="Lead Information">
        <Grid container spacing={1.5}>
          {([['Agency Name', lead.agencyName], ['Contact Person', lead.contactPerson], ['Phone', lead.phone],
            ['Email', lead.email], ['Province', lead.province], ['Facebook', lead.facebook],
            ['Website', lead.website], ['Source', lead.source], ['Notes', lead.notes],
            ['Recorded By', lead.recordedBy?.name], ['Date Recorded', fmtDate(lead.createdAt)],
          ] as [string, any][]).map(([label, val]) => (
            <Grid item xs={12} sm={6} key={label}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2">{val || '-'}</Typography>
            </Grid>
          ))}
        </Grid>
        <Button size="small" sx={{ mt: 1 }} onClick={() => setEdit(true)}>Edit</Button>
      </Section>
    </Box>
  );

  return (
    <Box>
      <Section title="Edit Lead Information">
        <Grid container spacing={1.5}>
          <Grid item xs={12}><TextField label="Agency Name" fullWidth size="small" value={form.agencyName} onChange={set('agencyName')} /></Grid>
          <Grid item xs={6}><TextField label="Contact Person" fullWidth size="small" value={form.contactPerson} onChange={set('contactPerson')} /></Grid>
          <Grid item xs={6}><TextField label="Phone" fullWidth size="small" value={form.phone} onChange={set('phone')} /></Grid>
          <Grid item xs={6}><TextField label="Email" fullWidth size="small" value={form.email} onChange={set('email')} /></Grid>
          <Grid item xs={6}><TextField label="Province" fullWidth size="small" value={form.province} onChange={set('province')} /></Grid>
          <Grid item xs={6}><TextField label="Facebook" fullWidth size="small" value={form.facebook} onChange={set('facebook')} /></Grid>
          <Grid item xs={6}><TextField label="Website" fullWidth size="small" value={form.website} onChange={set('website')} /></Grid>
          <Grid item xs={6}>
            <TextField select label="Source" fullWidth size="small" value={form.source} onChange={set('source')}>
              {SOURCES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}><TextField label="Notes" fullWidth size="small" multiline rows={2} value={form.notes} onChange={set('notes')} /></Grid>
        </Grid>
        <Stack direction="row" spacing={1} mt={1.5}>
          <Button variant="contained" onClick={save} disabled={saving}>Save</Button>
          <Button onClick={() => setEdit(false)}>Cancel</Button>
        </Stack>
      </Section>
    </Box>
  );
}

// Step 2
function StepAssign({ lead, employees, onRefresh }: { lead: Lead; employees: Employee[]; onRefresh: () => void }) {
  const [empId, setEmpId] = useState(lead.assignedToId ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/assign`, { employeeId: empId }); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Assign Sale">
      {lead.assignedTo && (
        <Alert severity="info" sx={{ mb: 1.5 }}>Current: {lead.assignedTo.name} ({lead.assignedTo.code})</Alert>
      )}
      <TextField select fullWidth size="small" label="Select Sale" value={empId} onChange={e => setEmpId(e.target.value)}>
        <MenuItem value="">— Unassigned —</MenuItem>
        {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name} ({e.code})</MenuItem>)}
      </TextField>
      <SaveBtn onClick={save} saving={saving} />
    </Section>
  );
}

// Step 3
function StepQualification({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({
    result: lead.qualResult ?? '',
    hasOffice: lead.qualHasOffice ?? false,
    agentCount: lead.qualAgentCount?.toString() ?? '',
    propertyType: lead.qualPropertyType ?? '',
    doesMarketing: lead.qualDoesMarketing ?? false,
    hasPotential: lead.qualHasPotential ?? false,
    serviceArea: lead.qualServiceArea ?? '',
    notes: lead.qualNotes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/qualify`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Qualification Assessment">
      <Stack spacing={1.5}>
        <Grid container spacing={1}>
          {[
            { key: 'hasOffice', label: 'Has Office' },
            { key: 'doesMarketing', label: 'Does Marketing' },
            { key: 'hasPotential', label: 'Has Potential' },
          ].map(f => (
            <Grid item xs={12} sm={4} key={f.key}>
              <FormControlLabel
                control={<Checkbox checked={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} />}
                label={f.label}
              />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={1.5}>
          <Grid item xs={6}><TextField label="Number of Agents" size="small" fullWidth type="number" value={form.agentCount} onChange={e => setForm(p => ({ ...p, agentCount: e.target.value }))} /></Grid>
          <Grid item xs={6}><TextField label="Property Type" size="small" fullWidth value={form.propertyType} onChange={e => setForm(p => ({ ...p, propertyType: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Service Area" size="small" fullWidth value={form.serviceArea} onChange={e => setForm(p => ({ ...p, serviceArea: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Notes" size="small" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Grid>
        </Grid>
        <TextField select fullWidth size="small" label="Assessment Result *" value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))}>
          <MenuItem value="qualified">✅ Qualified</MenuItem>
          <MenuItem value="not_qualified">❌ Not Qualified</MenuItem>
          <MenuItem value="need_info">❓ Need More Information</MenuItem>
        </TextField>
        <SaveBtn onClick={save} saving={saving} />
      </Stack>
    </Section>
  );
}

// Step 4
function StepContact({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({ contactDate: new Date().toISOString().slice(0, 10), result: '', contactedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.result) return;
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/contacts`, form); onRefresh(); setForm(f => ({ ...f, result: '', notes: '' })); }
    finally { setSaving(false); }
  };
  return (
    <Box>
      {lead.contacts && lead.contacts.length > 0 && (
        <Section title="Call History">
          <Stack spacing={0.75} mb={2}>
            {lead.contacts.map(c => (
              <Paper key={c.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontSize={12}>{fmtDate(c.contactDate)}</Typography>
                  <Chip label={CONTACT_RESULTS.find(r => r.value === c.result)?.label ?? c.result} size="small" />
                  {c.contactedBy && <Typography fontSize={12} color="text.secondary">Answered by: {c.contactedBy}</Typography>}
                </Stack>
                {c.notes && <Typography fontSize={12} color="text.secondary">{c.notes}</Typography>}
              </Paper>
            ))}
          </Stack>
        </Section>
      )}
      <Section title="Log a Call">
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}><TextField label="Date" size="small" fullWidth type="date" value={form.contactDate} onChange={e => setForm(f => ({ ...f, contactDate: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth size="small" label="Call Result *" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
              {CONTACT_RESULTS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}><TextField label="Answered By" size="small" fullWidth value={form.contactedBy} onChange={e => setForm(f => ({ ...f, contactedBy: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Notes" size="small" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Grid>
        </Grid>
        <SaveBtn onClick={save} saving={saving} />
      </Section>
    </Box>
  );
}

// Step 5
function StepAppointment({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({ type: '', apptDate: new Date().toISOString().slice(0, 16), location: '', attendees: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.type) return;
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/appointments`, form); onRefresh(); setForm(f => ({ ...f, type: '', location: '', notes: '' })); }
    finally { setSaving(false); }
  };
  return (
    <Box>
      {lead.appointments && lead.appointments.length > 0 && (
        <Section title="Past Appointments">
          <Stack spacing={0.75} mb={2}>
            {lead.appointments.map(a => (
              <Paper key={a.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={APPT_TYPES.find(t => t.value === a.type)?.label ?? a.type} size="small" color="primary" />
                  <Typography fontSize={12}>{fmtDate(a.apptDate)}</Typography>
                  {a.location && <Typography fontSize={12} color="text.secondary">{a.location}</Typography>}
                </Stack>
                {a.notes && <Typography fontSize={12} color="text.secondary">{a.notes}</Typography>}
              </Paper>
            ))}
          </Stack>
        </Section>
      )}
      <Section title="Create Appointment">
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth size="small" label="Appointment Type *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {APPT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}><TextField label="Date / Time" size="small" fullWidth type="datetime-local" value={form.apptDate} onChange={e => setForm(f => ({ ...f, apptDate: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Location" size="small" fullWidth value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Attendees" size="small" fullWidth value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} /></Grid>
          <Grid item xs={12}><TextField label="Notes" size="small" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Grid>
        </Grid>
        <SaveBtn onClick={save} saving={saving} />
      </Section>
    </Box>
  );
}

// Step 6
function StepSiteVisit({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({ visitedAt: new Date().toISOString().slice(0, 16), latitude: '', longitude: '', report: '' });
  const [saving, setSaving] = useState(false);
  const getGps = () => {
    navigator.geolocation?.getCurrentPosition(p => setForm(f => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })));
  };
  const save = async () => {
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/site-visits`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Box>
      {lead.siteVisits && lead.siteVisits.length > 0 && (
        <Section title="Past Site Visits">
          {lead.siteVisits.map(v => (
            <Paper key={v.id} variant="outlined" sx={{ p: 1, mb: 0.75 }}>
              <Typography fontSize={12}>{fmtDate(v.visitedAt)}</Typography>
              {v.report && <Typography fontSize={12} color="text.secondary">{v.report}</Typography>}
            </Paper>
          ))}
        </Section>
      )}
      <Section title="Log Site Visit">
        <Grid container spacing={1.5}>
          <Grid item xs={12}><TextField label="Date / Time" size="small" fullWidth type="datetime-local" value={form.visitedAt} onChange={e => setForm(f => ({ ...f, visitedAt: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={5}><TextField label="Latitude" size="small" fullWidth value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></Grid>
          <Grid item xs={5}><TextField label="Longitude" size="small" fullWidth value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></Grid>
          <Grid item xs={2}><Button fullWidth variant="outlined" size="small" onClick={getGps} sx={{ height: 40 }}>GPS</Button></Grid>
          <Grid item xs={12}><TextField label="Meeting Report" size="small" fullWidth multiline rows={4} value={form.report} onChange={e => setForm(f => ({ ...f, report: e.target.value }))} /></Grid>
        </Grid>
        <SaveBtn onClick={save} saving={saving} />
      </Section>
    </Box>
  );
}

// Step 7
function StepEvaluation({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const init: Record<string, number> = {};
  for (const f of EVAL_FIELDS) init[f.key] = (lead as any)[`eval${f.key.charAt(0).toUpperCase()}${f.key.slice(1)}`] ?? 5;
  const [scores, setScores] = useState(init);
  const [notes, setNotes] = useState(lead.evalNotes ?? '');
  const [saving, setSaving] = useState(false);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}/evaluation`, { ...scores, notes }); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Agency Evaluation">
      {lead.evalTotalScore !== undefined && lead.evalTotalScore !== null && (
        <Alert severity="info" sx={{ mb: 1.5 }}>Current Score: {lead.evalTotalScore}/70</Alert>
      )}
      <Stack spacing={1.5}>
        {EVAL_FIELDS.map(f => (
          <Box key={f.key}>
            <Stack direction="row" justifyContent="space-between">
              <Typography fontSize={13}>{f.label}</Typography>
              <Typography fontSize={13} fontWeight={700}>{scores[f.key]}/10</Typography>
            </Stack>
            <Slider value={scores[f.key]} min={1} max={10} step={1} onChange={(_, v) => setScores(s => ({ ...s, [f.key]: v as number }))} />
          </Box>
        ))}
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, textAlign: 'center' }}>
          <Typography fontWeight={700}>Total Score: {total}/70</Typography>
        </Box>
        <TextField label="Notes" size="small" fullWidth multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        <SaveBtn onClick={save} saving={saving} />
      </Stack>
    </Section>
  );
}

// Step 8
function StepApproval({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({ decision: lead.approvalDecision ?? '', notes: lead.approvalNotes ?? '', rejectReason: lead.rejectReason ?? '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.decision) return;
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}/approval`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Approve / Reject">
      {lead.evalTotalScore !== undefined && <Alert severity="info" sx={{ mb: 1.5 }}>Evaluation Score: {lead.evalTotalScore}/70</Alert>}
      <Stack spacing={1.5}>
        <TextField select fullWidth size="small" label="Decision *" value={form.decision} onChange={e => setForm(f => ({ ...f, decision: e.target.value }))}>
          <MenuItem value="approved">✅ Approved (Active Prospect)</MenuItem>
          <MenuItem value="rejected">❌ Rejected</MenuItem>
        </TextField>
        {form.decision === 'rejected' && (
          <TextField label="Rejection Reason" size="small" fullWidth multiline rows={2} value={form.rejectReason} onChange={e => setForm(f => ({ ...f, rejectReason: e.target.value }))} />
        )}
        <TextField label="Notes" size="small" fullWidth multiline rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <SaveBtn onClick={save} saving={saving} />
      </Stack>
    </Section>
  );
}

// Step 9
function StepAgreement({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({
    agreementNo: lead.agreementNo ?? '',
    startDate: lead.agreementStart?.slice(0, 10) ?? '',
    endDate: lead.agreementEnd?.slice(0, 10) ?? '',
    contractUrl: lead.agreementUrl ?? '',
    signed: lead.agreementSigned ?? false,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}/agreement`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Agreement">
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6}><TextField label="Agreement No." size="small" fullWidth value={form.agreementNo} onChange={e => setForm(f => ({ ...f, agreementNo: e.target.value }))} /></Grid>
        <Grid item xs={12} sm={3}><TextField label="Start Date" size="small" fullWidth type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={12} sm={3}><TextField label="End Date" size="small" fullWidth type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={12}><TextField label="Contract Link / URL" size="small" fullWidth value={form.contractUrl} onChange={e => setForm(f => ({ ...f, contractUrl: e.target.value }))} /></Grid>
        <Grid item xs={12}><FormControlLabel control={<Checkbox checked={form.signed} onChange={e => setForm(f => ({ ...f, signed: e.target.checked }))} />} label="Signed" /></Grid>
      </Grid>
      <SaveBtn onClick={save} saving={saving} />
    </Section>
  );
}

// Step 10
function StepOnboarding({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const init = ONBOARDING_ITEMS.reduce((a, item) => ({ ...a, [item.key]: (lead.onboardingChecklist as any)?.[item.key] ?? false }), {} as Record<string, boolean>);
  const [checklist, setChecklist] = useState(init);
  const [saving, setSaving] = useState(false);
  const doneCount = Object.values(checklist).filter(Boolean).length;
  const pct = Math.round((doneCount / ONBOARDING_ITEMS.length) * 100);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}/onboarding`, { checklist }); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title={`Onboarding Checklist — ${pct}% (${doneCount}/${ONBOARDING_ITEMS.length})`}>
      <Stack spacing={0.5} mb={1.5}>
        {ONBOARDING_ITEMS.map(item => (
          <FormControlLabel
            key={item.key}
            control={<Checkbox checked={checklist[item.key]} onChange={e => setChecklist(c => ({ ...c, [item.key]: e.target.checked }))} />}
            label={item.label}
          />
        ))}
      </Stack>
      <SaveBtn onClick={save} saving={saving} />
    </Section>
  );
}

// Step 11
function StepTraining({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({
    date: lead.trainingDate?.slice(0, 10) ?? '',
    topics: lead.trainingTopics ?? '',
    trainer: lead.trainingTrainer ?? '',
    score: lead.trainingScore?.toString() ?? '',
    certified: lead.trainingCertified ?? false,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/acquisition/leads/${lead.id}/training`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Training">
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6}><TextField label="Training Date" size="small" fullWidth type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Trainer" size="small" fullWidth value={form.trainer} onChange={e => setForm(f => ({ ...f, trainer: e.target.value }))} /></Grid>
        <Grid item xs={12}><TextField label="Training Topics" size="small" fullWidth multiline rows={2} value={form.topics} onChange={e => setForm(f => ({ ...f, topics: e.target.value }))} /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Post-Training Score (0-100)" size="small" fullWidth type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} /></Grid>
        <Grid item xs={12}><FormControlLabel control={<Checkbox checked={form.certified} onChange={e => setForm(f => ({ ...f, certified: e.target.checked }))} />} label="Certificate Issued" /></Grid>
      </Grid>
      <SaveBtn onClick={save} saving={saving} />
    </Section>
  );
}

// Step 12
function StepMarketing({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({ type: '', quantity: '', notes: '', deliveredAt: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.type) return;
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/marketing`, form); onRefresh(); setForm(f => ({ ...f, type: '', quantity: '', notes: '' })); }
    finally { setSaving(false); }
  };
  return (
    <Box>
      {lead.marketingItems && lead.marketingItems.length > 0 && (
        <Section title="Materials Delivered">
          <Stack spacing={0.5} mb={1.5}>
            {lead.marketingItems.map(m => (
              <Paper key={m.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={m.type} size="small" />
                  {m.quantity && <Typography fontSize={12}>x{m.quantity}</Typography>}
                  {m.deliveredAt && <Typography fontSize={12} color="text.secondary">{fmtDate(m.deliveredAt)}</Typography>}
                </Stack>
                {m.notes && <Typography fontSize={12} color="text.secondary">{m.notes}</Typography>}
              </Paper>
            ))}
          </Stack>
        </Section>
      )}
      <Section title="Add Marketing Support">
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={5}>
            <TextField select fullWidth size="small" label="Type *" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {MARKETING_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}><TextField label="Quantity" size="small" fullWidth type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></Grid>
          <Grid item xs={6} sm={4}><TextField label="Delivery Date" size="small" fullWidth type="date" value={form.deliveredAt} onChange={e => setForm(f => ({ ...f, deliveredAt: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12}><TextField label="Notes" size="small" fullWidth value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Grid>
        </Grid>
        <SaveBtn onClick={save} saving={saving} />
      </Section>
    </Box>
  );
}

// Step 13
function StepFirstSale({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    project: '', units: '', value: '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.post(`/acquisition/leads/${lead.id}/first-sale`, form); onRefresh(); }
    finally { setSaving(false); }
  };
  if (lead.firstSaleDate) {
    return (
      <Section title="🎉 First Sale">
        <Alert severity="success">
          First sale recorded — {fmtDate(lead.firstSaleDate)}
          {lead.firstSaleProject && ` · ${lead.firstSaleProject}`}
          {lead.firstSaleUnits && ` · ${lead.firstSaleUnits} units`}
          {lead.firstSaleValue && ` · ฿${Number(lead.firstSaleValue).toLocaleString()}`}
        </Alert>
      </Section>
    );
  }
  return (
    <Section title="Log First Sale">
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Once the Agency records their first sale, the status will automatically change to Active Agency.
      </Typography>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6}><TextField label="Sale Date" size="small" fullWidth type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} InputLabelProps={{ shrink: true }} /></Grid>
        <Grid item xs={12} sm={6}><TextField label="Project" size="small" fullWidth value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} /></Grid>
        <Grid item xs={6}><TextField label="Number of Units" size="small" fullWidth type="number" value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} /></Grid>
        <Grid item xs={6}><TextField label="Value (THB)" size="small" fullWidth type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></Grid>
      </Grid>
      <SaveBtn onClick={save} saving={saving} />
    </Section>
  );
}

// Step 14 (final)
function StepActiveAgency({ lead }: { lead: Lead }) {
  return (
    <Section title="🌟 Active Agency">
      <Alert severity="success" sx={{ mb: 2 }}>
        <Typography fontWeight={700}>{lead.agencyName} is now an Active Agency!</Typography>
        {lead.firstSaleDate && <Typography variant="body2">First Sale: {fmtDate(lead.firstSaleDate)}</Typography>}
      </Alert>
      <Grid container spacing={1.5}>
        {[
          ['Agreement No.', lead.agreementNo],
          ['Agreement Start', fmtDate(lead.agreementStart)],
          ['Agreement End', fmtDate(lead.agreementEnd)],
          ['Training', lead.trainingCertified ? '✅ Certified' : '-'],
          ['First Sale', fmtDate(lead.firstSaleDate)],
          ['Project', lead.firstSaleProject],
        ].map(([label, val]) => (
          <Grid item xs={6} key={label as string}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={500}>{val || '-'}</Typography>
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}
