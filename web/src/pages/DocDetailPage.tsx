import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Chip, Grid, Divider, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Avatar, Table, TableHead,
  TableRow, TableCell, TableBody, IconButton, Tooltip,
} from '@mui/material';
import {
  ArrowBack, Edit, PlayArrow, Print, History, CheckCircle, RadioButtonUnchecked,
  HistoryEdu, Fingerprint,
} from '@mui/icons-material';
import { api, errMsg } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SignaturePad } from '../components/SignaturePad';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8', pending_review: '#60A5FA', pending_approval: '#FBBF24',
  approved: '#34D399', signing: '#818CF8', completed: '#22C55E', cancelled: '#EF4444',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', pending_review: 'Pending Closer Review', pending_approval: 'Pending Approval',
  approved: 'Approved', signing: 'Pending Signature', completed: 'Completed', cancelled: 'Cancelled',
};
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['pending_review', 'cancelled'],
  pending_review: ['pending_approval', 'draft'],
  pending_approval: ['approved', 'pending_review'],
  approved: ['signing'],
  signing: ['cancelled'],
  completed: [],
  cancelled: [],
};
const NEXT_LABEL: Record<string, string> = {
  pending_review: 'Submit to Closer', pending_approval: 'Submit for Approval',
  approved: 'Approve', signing: 'Send for Signature', draft: 'Revert to Draft', cancelled: 'Cancel',
};
const MONTH_TH = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const VISIT_TYPE_TH: Record<string,string> = { site_visit:'Site Visit', follow_up:'Follow-up', training:'Training', new_agency:'New Agency' };
const DOC_TITLE: Record<string,string> = { sva:'Site Visit Assignment', svr:'Site Visit Completion Report', mpa:'Monthly Performance Acknowledgement' };

interface DocDetail {
  id: string; docType: string; docNumber?: string; month: number; year: number;
  version: number; status: string; companyName: string; declaration?: string; notes?: string;
  requiredSigners: string[];
  kpiSiteVisit?: number; kpiFollowup?: number; kpiNewAgency?: number; kpiTraining?: number; kpiSales?: number;
  actualSiteVisit?: number; actualFollowup?: number; actualNewAgency?: number; actualSales?: number;
  workingDays?: number; leaveDays?: number; gpsCompliancePct?: number; photoCompliancePct?: number;
  supervisorScore?: number; supervisorComment?: string; supervisorPlan?: string;
  employeeComment?: string; aiAnalysis?: { strength?: string; weakness?: string; suggestion?: string; score?: number };
  employee: { id: string; name: string; code: string; position: string; zone?: string; team?: { name: string } };
  supervisor?: { id: string; name: string };
  closer?: { id: string; name: string };
  approvedBy?: { id: string; name: string };
  createdBy: { id: string; name: string };
  approvedAt?: string; effectiveAt?: string; createdAt: string;
  rows: Array<{ id: string; rowType: string; sortOrder: number; visitDate?: string; visitTime?: string;
    agencyName?: string; contactPerson?: string; province?: string; visitType?: string;
    priority?: string; status?: string; plannedTime?: string; actualTime?: string; result?: string;
    kpiName?: string; kpiTarget?: number; kpiActual?: number; activityName?: string; activityDone?: boolean; note?: string }>;
  signatures: Array<{ id: string; signerType: string; signedAt: string; signedBy: { id: string; name: string }; signatureData?: string; revokedAt?: string }>;
  auditLogs: Array<{ id: string; action: string; detail?: Record<string,unknown>; createdAt: string; actor: { name: string } }>;
  versions: Array<{ id: string; version: number; reason?: string; createdAt: string; createdBy: { name: string } }>;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(d).toLocaleDateString('th-TH');
}

const AUDIT_LABELS: Record<string,string> = {
  create:'📝 Document Created', edit:'✏️ Edited', status_change:'🔄 Status Changed',
  employee_sign:'✍️ Employee Signed', supervisor_sign:'✍️ Supervisor Signed',
  manager_sign:'✍️ Manager Signed', revoke_signature:'🚫 Signature Revoked',
  generate_schedule:'🤖 AI Generated Schedule', new_version:'📄 New Version', completed:'✅ Completed',
};

export default function DocDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? user?.role ?? '');
  const isManager = ['manager', 'super_admin', 'admin', 'closer'].includes(user?.activeRole ?? user?.role ?? '');

  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  const [signDialog, setSignDialog] = useState<string | null>(null); // signer type
  const [revokeDialog, setRevokeDialog] = useState<string | null>(null); // sig id
  const [revokeReason, setRevokeReason] = useState('');
  const [signingInProgress, setSigningInProgress] = useState(false);

  const [versionDialog, setVersionDialog] = useState(false);
  const [versionReason, setVersionReason] = useState('');

  useEffect(() => { if (id) fetchDoc(id); }, [id]);

  const fetchDoc = async (docId: string) => {
    setLoading(true);
    try {
      const r = await api.get<DocDetail>(`/docs/${docId}`);
      setDoc(r.data);
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  };

  const changeStatus = async () => {
    if (!id || !newStatus) return;
    setChangingStatus(true);
    try {
      await api.patch(`/docs/${id}/status`, { status: newStatus, note: statusNote });
      setStatusDialog(false); setStatusNote('');
      await fetchDoc(id);
    } catch (e) { setError(errMsg(e)); }
    finally { setChangingStatus(false); }
  };

  const handleSign = async (dataUrl: string) => {
    if (!id || !signDialog) return;
    setSigningInProgress(true);
    try {
      await api.post(`/docs/${id}/sign`, { signerType: signDialog, signatureData: dataUrl });
      setSignDialog(null);
      await fetchDoc(id);
    } catch (e) { setError(errMsg(e)); }
    finally { setSigningInProgress(false); }
  };

  const handleRevoke = async () => {
    if (!id || !revokeDialog || !revokeReason) return;
    try {
      await api.delete(`/docs/${id}/signatures/${revokeDialog}`, { data: { reason: revokeReason } });
      setRevokeDialog(null); setRevokeReason('');
      await fetchDoc(id);
    } catch (e) { setError(errMsg(e)); }
  };

  const createVersion = async () => {
    if (!id || !versionReason) return;
    try {
      await api.post(`/docs/${id}/version`, { reason: versionReason });
      setVersionDialog(false); setVersionReason('');
      await fetchDoc(id);
    } catch (e) { setError(errMsg(e)); }
  };

  if (loading) return <Box p={6} textAlign="center"><CircularProgress /></Box>;
  if (!doc) return <Box p={3}><Alert severity="error">{error || 'Document not found'}</Alert></Box>;

  const scheduleRows = doc.rows.filter(r => r.rowType === 'schedule').sort((a, b) => a.sortOrder - b.sortOrder);
  const kpiRows = doc.rows.filter(r => r.rowType === 'kpi');
  const activityRows = doc.rows.filter(r => r.rowType === 'activity');

  const signedMap = new Map(doc.signatures.filter(s => !s.revokedAt).map(s => [s.signerType, s]));
  const nextStatuses = NEXT_STATUS[doc.status] ?? [];
  const canSign = doc.status === 'signing';
  const canEdit = isManager || (doc.status === 'draft');

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/docs')}><ArrowBack /></IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>{doc.docNumber ?? doc.id.slice(0, 12)}</Typography>
            <Typography variant="body2" color="text.secondary">{DOC_TITLE[doc.docType]} · V{doc.version} · {MONTH_TH[doc.month]} {doc.year}</Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end" alignItems="center">
          <Chip label={STATUS_LABELS[doc.status] ?? doc.status} sx={{ bgcolor: STATUS_COLORS[doc.status], color: '#fff', fontWeight: 700 }} />
          {canEdit && <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/docs/${id}/edit`)}>Edit</Button>}
          {nextStatuses.length > 0 && (
            <Button size="small" variant="contained" startIcon={<PlayArrow />} onClick={() => { setNewStatus(nextStatuses[0]); setStatusDialog(true); }}>
              {NEXT_LABEL[nextStatuses[0]] ?? nextStatuses[0]}
            </Button>
          )}
          <Tooltip title="Print / Export PDF">
            <Button size="small" variant="outlined" startIcon={<Print />} onClick={() => window.open(`/docs/${id}/print`, '_blank')}>PDF</Button>
          </Tooltip>
          {isManager && (
            <Tooltip title="Create New Version">
              <Button size="small" variant="outlined" startIcon={<History />} onClick={() => setVersionDialog(true)}>New Version</Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Left */}
        <Grid item xs={12} md={8}>
          {/* Employee Info */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Employee Information</Typography>
            <Grid container spacing={1}>
              {[
                ['Code', doc.employee.code],
                ['Name', doc.employee.name],
                ['Position', doc.employee.position],
                ['Team', doc.employee.team?.name ?? '—'],
                ['Zone', doc.employee.zone ?? '—'],
                ['Supervisor', doc.supervisor?.name ?? '—'],
                ['Closer', doc.closer?.name ?? '—'],
                ['Approved By', doc.approvedBy?.name ?? '—'],
              ].map(([label, val]) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={500}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* KPI */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Monthly KPI</Typography>
            <Grid container spacing={1}>
              {[
                ['Site Visit', doc.kpiSiteVisit, doc.actualSiteVisit],
                ['Follow-up', doc.kpiFollowup, doc.actualFollowup],
                ['New Agency', doc.kpiNewAgency, doc.actualNewAgency],
                ['Training', doc.kpiTraining, undefined],
                ['Sales', doc.kpiSales, doc.actualSales],
              ].filter(([,t]) => t != null).map(([label, target, actual]) => (
                <Grid item xs={6} sm={4} md={3} key={String(label)}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{String(label)}</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary">{String(target)}</Typography>
                    {actual != null && (
                      <Typography variant="body2" color={Number(actual) >= Number(target) ? 'success.main' : 'error.main'}>
                        Actual: {String(actual)}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* MPA KPI table */}
          {doc.docType === 'mpa' && kpiRows.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Performance Results</Typography>
              <Table size="small">
                <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 600 }}>KPI</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Target</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actual</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Achievement</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {kpiRows.map(row => {
                    const pct = row.kpiTarget ? Math.round(((row.kpiActual ?? 0) / row.kpiTarget) * 100) : 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.kpiName}</TableCell>
                        <TableCell>{row.kpiTarget ?? '—'}</TableCell>
                        <TableCell>{row.kpiActual ?? '—'}</TableCell>
                        <TableCell><Chip label={`${pct}%`} size="small" color={pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'error'} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Schedule (SVA/SVR) */}
          {(doc.docType === 'sva' || doc.docType === 'svr') && scheduleRows.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Work Schedule ({scheduleRows.length} items)</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
                    {['Date','Time','Agency','Contact','Province','Type','Status'].map(h => <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>)}
                    {doc.docType === 'svr' && <TableCell sx={{ fontWeight: 600 }}>Visit Result</TableCell>}
                  </TableRow></TableHead>
                  <TableBody>
                    {scheduleRows.map(row => (
                      <TableRow key={row.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.visitDate ? new Date(row.visitDate).toLocaleDateString('en-GB') : '—'}</TableCell>
                        <TableCell>{row.visitTime ?? '—'}</TableCell>
                        <TableCell><Typography variant="body2" sx={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.agencyName}</Typography></TableCell>
                        <TableCell>{row.contactPerson ?? '—'}</TableCell>
                        <TableCell>{row.province ?? '—'}</TableCell>
                        <TableCell><Chip label={VISIT_TYPE_TH[row.visitType ?? ''] ?? row.visitType ?? '—'} size="small" /></TableCell>
                        <TableCell>
                          <Chip label={row.status ?? 'scheduled'} size="small"
                            color={row.status === 'completed' ? 'success' : row.status === 'cancelled' ? 'error' : 'default'} />
                        </TableCell>
                        {doc.docType === 'svr' && <TableCell>{row.result ?? '—'}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          )}

          {/* SVR Activity Summary */}
          {doc.docType === 'svr' && activityRows.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Activity Summary</Typography>
              <Grid container spacing={1}>
                {activityRows.map(row => (
                  <Grid item xs={6} sm={4} key={row.id}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {row.activityDone ? <CheckCircle sx={{ fontSize: 16, color: '#22C55E' }} /> : <RadioButtonUnchecked sx={{ fontSize: 16, color: '#CBD5E1' }} />}
                      <Typography variant="body2">{row.activityName}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Evaluations (SVR/MPA) */}
          {(doc.supervisorComment || doc.employeeComment) && (
            <Paper sx={{ p: 2, mb: 2 }}>
              {doc.supervisorComment && (
                <Box mb={2}>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Supervisor Evaluation</Typography>
                  {doc.supervisorScore != null && <Chip label={`Score: ${doc.supervisorScore}/100`} color="primary" size="small" sx={{ mb: 1 }} />}
                  <Typography variant="body2">{doc.supervisorComment}</Typography>
                  {doc.supervisorPlan && <Typography variant="body2" color="text.secondary" mt={1}>Development Plan: {doc.supervisorPlan}</Typography>}
                </Box>
              )}
              {doc.employeeComment && (
                <Box>
                  <Divider sx={{ mb: 1 }} />
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Employee Comments</Typography>
                  <Typography variant="body2">{doc.employeeComment}</Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Declaration */}
          {doc.declaration && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#FAFAF5', border: '1px solid #E5E7EB' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Declaration</Typography>
              <Typography variant="body2" fontStyle="italic">"{doc.declaration}"</Typography>
            </Paper>
          )}
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Signature Section */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Fingerprint sx={{ color: '#7C3AED' }} />
              <Typography variant="subtitle2" fontWeight={700}>Signatures</Typography>
            </Box>
            {doc.requiredSigners.map((signerType) => {
              const sig = signedMap.get(signerType);
              const signerLabel = signerType === 'employee' ? 'Employee' : signerType === 'supervisor' ? 'Supervisor' : 'Manager';
              return (
                <Box key={signerType} mb={2} p={1.5} sx={{ border: `1.5px ${sig ? 'solid #22C55E' : 'dashed #CBD5E1'}`, borderRadius: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {sig ? <CheckCircle sx={{ fontSize: 16, color: '#22C55E' }} /> : <RadioButtonUnchecked sx={{ fontSize: 16, color: '#CBD5E1' }} />}
                      <Typography variant="body2" fontWeight={600}>{signerLabel}</Typography>
                    </Box>
                    {sig ? (
                      isAdmin && <Button size="small" color="error" onClick={() => { setRevokeDialog(sig.id); setRevokeReason(''); }}>Revoke</Button>
                    ) : (
                      canSign && <Button size="small" variant="contained" onClick={() => setSignDialog(signerType)}>Sign</Button>
                    )}
                  </Box>
                  {sig && (
                    <Box mt={1}>
                      {sig.signatureData && <img src={sig.signatureData} alt="signature" style={{ width: '100%', maxHeight: 60, objectFit: 'contain' }} />}
                      <Typography variant="caption" color="text.secondary" display="block">{sig.signedBy.name} · {new Date(sig.signedAt).toLocaleDateString('en-GB')}</Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Paper>

          {/* Version History */}
          {doc.versions.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <History sx={{ color: '#6B7280', fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight={700}>Version History</Typography>
              </Box>
              {doc.versions.map(v => (
                <Box key={v.id} display="flex" justifyContent="space-between" mb={1}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>V{v.version}</Typography>
                    <Typography variant="caption" color="text.secondary">{v.reason}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{new Date(v.createdAt).toLocaleDateString('en-GB')}</Typography>
                </Box>
              ))}
            </Paper>
          )}

          {/* Audit Log */}
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <HistoryEdu sx={{ color: '#6B7280', fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={700}>Activity Log</Typography>
            </Box>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {doc.auditLogs.map((log, i) => (
                <Box key={log.id} display="flex" gap={1} mb={1.5} position="relative">
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#4F46E5' }}>{log.actor.name[0]}</Avatar>
                    {i < doc.auditLogs.length - 1 && <Box sx={{ position: 'absolute', left: '50%', top: 22, bottom: -6, width: 1, bgcolor: '#E2E8F0', transform: 'translateX(-50%)' }} />}
                  </Box>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">{log.actor.name} · {timeAgo(log.createdAt)}</Typography>
                    <Typography variant="body2" sx={{ fontSize: 12 }}>{AUDIT_LABELS[log.action] ?? log.action}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Status Change Dialog */}
      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>New Status</InputLabel>
            <Select value={newStatus} label="New Status" onChange={e => setNewStatus(e.target.value)}>
              {nextStatuses.map(s => (
                <MenuItem key={s} value={s}><Chip label={STATUS_LABELS[s] ?? s} size="small" sx={{ bgcolor: STATUS_COLORS[s], color: '#fff' }} /></MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Remarks" fullWidth multiline rows={2} sx={{ mt: 2 }} value={statusNote} onChange={e => setStatusNote(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={changeStatus} disabled={changingStatus}>
            {changingStatus ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={Boolean(signDialog)} onClose={() => setSignDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Sign Document — {signDialog === 'employee' ? 'Employee' : signDialog === 'supervisor' ? 'Supervisor' : 'Manager'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            "{doc.declaration ?? 'I acknowledge and confirm the accuracy of this document.'}"
          </Typography>
          {signingInProgress ? <Box textAlign="center"><CircularProgress /></Box> : (
            <SignaturePad
              onSave={handleSign}
              onCancel={() => setSignDialog(null)}
              label={`Sign (${signDialog})`}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={Boolean(revokeDialog)} onClose={() => setRevokeDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoke Signature</DialogTitle>
        <DialogContent>
          <TextField label="Reason *" fullWidth multiline rows={2} sx={{ mt: 1 }} value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRevoke} disabled={!revokeReason}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {/* Version Dialog */}
      <Dialog open={versionDialog} onClose={() => setVersionDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create New Version</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>All signatures will be revoked and the status will revert to Draft.</Alert>
          <TextField label="Reason for Revision *" fullWidth multiline rows={2} value={versionReason} onChange={e => setVersionReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createVersion} disabled={!versionReason}>Create V{(doc.version || 0) + 1}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
