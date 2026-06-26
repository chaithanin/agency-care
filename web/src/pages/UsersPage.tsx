import { useEffect, useState } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Chip, Alert,
  MenuItem, FormControlLabel, Checkbox, IconButton, Tooltip,
  FormGroup,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';
import { useAuth, type Role } from '../auth/AuthContext';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  additionalRoles: string[];
  isActive: boolean;
  employee?: { id: string; code: string; name: string } | null;
}

const ROLES: Role[] = ['manager', 'super_admin', 'admin', 'closer', 'sales'];
const roleColor = (r: string) =>
  r === 'manager' ? 'success' : r === 'super_admin' ? 'secondary' : r === 'admin' ? 'error' : r === 'closer' ? 'warning' : 'primary';

const roleLabel: Record<string, string> = {
  manager: 'Manager', super_admin: 'Super Admin', admin: 'Admin', closer: 'Closer', sales: 'Sales',
};

const emptyCreate = { email: '', name: '', password: '', role: 'sales' };

export default function UsersPage() {
  const { t } = useT();
  const { user: me, startImpersonation } = useAuth();
  const [rows, setRows] = useState<User[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCreate });
  const [edit, setEdit] = useState<User | null>(null);
  const [pwFor, setPwFor] = useState<User | null>(null);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const canImpersonate = me && ['manager', 'super_admin', 'admin'].includes(me.role) && !me.isImpersonated;

  const load = () => api.get('/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError('');
    try {
      await api.post('/users', form);
      setCreateOpen(false); setForm({ ...emptyCreate }); load();
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
      });
      setEdit(null); load();
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>{t('nav.users')}</Typography>
        <Button variant="contained" onClick={() => { setError(''); setCreateOpen(true); }}>{t('usr.add')}</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
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
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>
                  <Chip size="small" color={roleColor(u.role) as any} label={roleLabel[u.role] ?? u.role} />
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
                  <IconButton size="small" title={t('common.edit')} onClick={() => { setError(''); setEdit({ ...u, additionalRoles: u.additionalRoles ?? [] }); }}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* เพิ่มผู้ใช้ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('usr.addTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label={t('usr.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label={t('d.fullName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField select label={t('usr.role')} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>)}
            </TextField>
            <TextField label={t('d.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required helperText={t('d.minChars')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
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
              <TextField label={t('d.fullName')} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <TextField select label={t('usr.role')} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value, additionalRoles: [] })}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{roleLabel[r]}</MenuItem>)}
              </TextField>
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
              <FormControlLabel
                control={<Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />}
                label={t('usr.enable')}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)}>{t('common.cancel')}</Button>
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
    </Box>
  );
}
