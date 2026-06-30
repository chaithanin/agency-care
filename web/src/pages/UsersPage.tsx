import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Chip, Alert,
  MenuItem, FormControlLabel, Checkbox, IconButton, Tooltip,
  FormGroup, Avatar, Badge, Input,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';
import { useAuth, type Role } from '../auth/AuthContext';
import { ExportPdfButton } from '../components/ExportPdfButton';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  additionalRoles: string[];
  isActive: boolean;
  employee?: { id: string; code: string; name: string } | null;
  photoUrl?: string;
  hasLimitedAccess?: boolean;
  assignedAgencies?: string[];
}

const ROLES: Role[] = ['manager', 'super_admin', 'admin', 'closer', 'sales'];
const roleColor = (r: string) =>
  r === 'manager' ? 'success' : r === 'super_admin' ? 'secondary' : r === 'admin' ? 'error' : r === 'closer' ? 'warning' : 'primary';

const roleLabel: Record<string, string> = {
  manager: 'Manager', super_admin: 'Super Admin', admin: 'Admin', closer: 'Closer', sales: 'Sales',
};

const emptyCreate = { email: '', name: '', password: '', role: 'sales', photoUrl: '' };

export default function UsersPage() {
  const { t } = useT();
  const { user: me, startImpersonation } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCreate });
  const [edit, setEdit] = useState<User | null>(null);
  const [pwFor, setPwFor] = useState<User | null>(null);
  const [pw, setPw] = useState('');
  const [deleteFor, setDeleteFor] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const canImpersonate = me && ['manager', 'super_admin', 'admin'].includes(me.role) && !me.isImpersonated;

  const load = () => api.get('/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    try {
      await api.post('/users', {
        email: form.email,
        name: form.name,
        password: form.password,
        role: form.role,
        photoUrl: form.photoUrl,
      });
      setCreateOpen(false); setForm({ ...emptyCreate }); setPhotoPreview(''); load();
    } catch (e) { setError(errMsg(e)); }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setError('');
    try {
      await api.patch(`/users/${edit.id}`, {
        name: edit.name,
        role: edit.role,
        additionalRoles: edit.additionalRoles,
        isActive: edit.isActive,
        photoUrl: edit.photoUrl,
        hasLimitedAccess: edit.hasLimitedAccess,
        assignedAgencies: edit.assignedAgencies,
      });
      setEdit(null); setPhotoPreview(''); load();
    } catch (e) { setError(errMsg(e)); }
  };

  const resetPw = async () => {
    if (!pwFor) return;
    setError('');
    try {
      await api.post(`/users/${pwFor.id}/reset-password`, { password: pw });
      setMsg(`${t('usr.resetTitle')} ${pwFor.email} ${t('usr.done')}`); setPwFor(null); setPw('');
    } catch (e) { setError(errMsg(e)); }
  };

  const deleteUser = async () => {
    if (!deleteFor) return;
    setError('');
    try {
      await api.delete(`/users/${deleteFor.id}`);
      setMsg(`${deleteFor.name} (${deleteFor.email}) ลบแล้ว`); setDeleteFor(null); load();
    } catch (e) { setError(errMsg(e)); }
  };

  const handleImpersonate = async (u: User) => {
    setError('');
    try {
      const { targetName } = await startImpersonation(u.id);
      setMsg(`${t('usr.viewingAs')} "${targetName}"`);
    } catch (e) { setError(errMsg(e)); }
  };

  const toggleAdditional = (role: Role, checked: boolean) => {
    if (!edit) return;
    const current = edit.additionalRoles ?? [];
    const updated = checked ? [...current, role] : current.filter((r) => r !== role);
    setEdit({ ...edit, additionalRoles: updated });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, isEdit: boolean = false) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPhotoPreview(base64);
      if (isEdit && edit) {
        setEdit({ ...edit, photoUrl: base64 });
      } else {
        setForm({ ...form, photoUrl: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('nav.users')}</Typography>
        <Stack direction="row" spacing={1}>
          <ExportPdfButton tableId="users-table" filename="users" title="Users" size="small" variant="outlined" />
          <Button variant="contained" onClick={() => { setError(''); setCreateOpen(true); }}>{t('usr.add')}</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Paper id="users-table">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Photo</TableCell>
              <TableCell>{t('usr.email')}</TableCell>
              <TableCell>{t('c.name')}</TableCell>
              <TableCell>{t('usr.role')}</TableCell>
              <TableCell>{t('usr.additionalRoles')}</TableCell>
              <TableCell>{t('usr.staff')}</TableCell>
              <TableCell align="center">{t('c.status')}</TableCell>
              <TableCell align="center">{t('c.manage')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.isActive ? 1 : 0.5 }}>
                <TableCell align="center">
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                    color={u.hasLimitedAccess ? 'warning' : 'success'}
                    invisible={!u.hasLimitedAccess}
                  >
                    <Avatar
                      src={u.photoUrl}
                      sx={{ width: 32, height: 32 }}
                      alt={u.name}
                    >
                      {!u.photoUrl && getInitials(u.name)}
                    </Avatar>
                  </Badge>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip size="small" color={roleColor(u.role) as any} label={roleLabel[u.role] ?? u.role} />
                    {u.hasLimitedAccess && (
                      <Tooltip title="Seller has limited access to assigned agencies only">
                        <LockIcon fontSize="small" color="warning" sx={{ display: 'flex' }} />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(u.additionalRoles ?? []).map((r) => (
                      <Chip key={r} size="small" variant="outlined" label={roleLabel[r] ?? r} />
                    ))}
                    {(!u.additionalRoles || u.additionalRoles.length === 0) && (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{u.employee ? `${u.employee.name} (${u.employee.code})` : '-'}</TableCell>
                <TableCell align="center">
                  <Chip size="small" label={u.isActive ? t('usr.active') : t('usr.off')} color={u.isActive ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" title={t('common.edit')} onClick={() => { setError(''); setEdit({ ...u, additionalRoles: u.additionalRoles ?? [] }); setPhotoPreview(u.photoUrl ?? ''); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" title={t('usr.resetTitle')} onClick={() => { setError(''); setPwFor(u); setPw(''); }}>
                    <KeyIcon fontSize="small" />
                  </IconButton>
                  {canImpersonate && u.id !== me?.id && (
                    <Tooltip title={t('usr.viewAsUser')}>
                      <IconButton size="small" color="warning" onClick={() => handleImpersonate(u)}>
                        <VisibilityRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" color="error" title="Delete user" onClick={() => { setError(''); setDeleteFor(u); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* เพิ่มผู้ใช้ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('usr.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Avatar
                  src={photoPreview}
                  sx={{ width: 80, height: 80 }}
                  alt={form.name || 'User'}
                >
                  {!photoPreview && getInitials(form.name || 'U')}
                </Avatar>
                <Input
                  type="file"
                  inputProps={{ accept: 'image/*' }}
                  onChange={(e) => handlePhotoUpload(e, false)}
                  startAdornment={<PhotoCameraIcon sx={{ mr: 1, color: 'action.active' }} />}
                  sx={{ display: 'none' }}
                  id="photo-input-create"
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => document.getElementById('photo-input-create')?.click()}
                >
                  Photo
                </Button>
              </Box>
              <Stack spacing={2} flex={1}>
                <TextField label={t('usr.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required fullWidth />
                <TextField label={t('d.fullName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
                <TextField select label={t('usr.role')} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} fullWidth>
                  {ROLES.map((r) => <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>)}
                </TextField>
                <TextField label={t('d.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required helperText={t('d.minChars')} fullWidth />
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setPhotoPreview(''); }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={create}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* แก้ไขผู้ใช้ */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('common.edit')}: {edit?.email}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} mt={1}>
              {error && <Alert severity="error">{error}</Alert>}

              {/* Photo and Basic Info */}
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={photoPreview || edit.photoUrl}
                    sx={{ width: 80, height: 80 }}
                    alt={edit.name}
                  >
                    {!photoPreview && !edit.photoUrl && getInitials(edit.name)}
                  </Avatar>
                  <Input
                    type="file"
                    inputProps={{ accept: 'image/*' }}
                    onChange={(e) => handlePhotoUpload(e, true)}
                    startAdornment={<PhotoCameraIcon sx={{ mr: 1, color: 'action.active' }} />}
                    sx={{ display: 'none' }}
                    id="photo-input-edit"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => document.getElementById('photo-input-edit')?.click()}
                  >
                    Photo
                  </Button>
                </Box>
                <Stack spacing={2} flex={1}>
                  <TextField label={t('d.fullName')} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} fullWidth />
                  <TextField select label={t('usr.role')} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value, additionalRoles: [] })} fullWidth>
                    {ROLES.map((r) => <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>)}
                  </TextField>
                </Stack>
              </Stack>

              {/* Role-based Access Control for Sellers */}
              {edit.role === 'sales' && (
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
                    <LockIcon fontSize="small" color="warning" />
                    Access Control
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={edit.hasLimitedAccess ?? false}
                        onChange={(e) => setEdit({ ...edit, hasLimitedAccess: e.target.checked })}
                      />
                    }
                    label="Seller can see only their assigned agencies"
                    sx={{ display: 'block', mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: 1 }}>
                    When enabled, this seller's dashboard, reports, and data will show only:
                    <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
                      <li>Their assigned agencies</li>
                      <li>Their own tasks/visits/appointments</li>
                    </ul>
                    Other functions (requests, settings) remain accessible.
                  </Typography>
                </Box>
              )}

              {/* Additional Roles */}
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                  {t('usr.additionalRoles')} ({t('usr.switchInSession')})
                </Typography>
                <FormGroup row>
                  {ROLES.filter((r) => r !== edit.role).map((r) => (
                    <FormControlLabel
                      key={r}
                      control={
                        <Checkbox
                          size="small"
                          checked={(edit.additionalRoles ?? []).includes(r)}
                          onChange={(e) => toggleAdditional(r, e.target.checked)}
                        />
                      }
                      label={roleLabel[r]}
                    />
                  ))}
                </FormGroup>
              </Box>

              {/* Status */}
              <FormControlLabel
                control={<Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />}
                label={t('usr.enable')}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEdit(null); setPhotoPreview(''); }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveEdit}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* รีเซ็ตรหัสผ่าน */}
      <Dialog open={!!pwFor} onClose={() => setPwFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('usr.resetTitle')}: {pwFor?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label={t('usr.newPw')} type="password" value={pw} onChange={(e) => setPw(e.target.value)} helperText={t('d.minChars')} autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="warning" onClick={resetPw} disabled={pw.length < 6}>{t('usr.reset')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteFor} onClose={() => setDeleteFor(null)} fullWidth maxWidth="xs">
        <DialogTitle color="error">Delete User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <Alert severity="warning">
              Delete <strong>{deleteFor?.name}</strong> ({deleteFor?.email})? This cannot be undone.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteFor(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={deleteUser}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
