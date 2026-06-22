import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { errMsg } from '../api/client';
import { useT } from '../i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const { t, lang, setLang } = useT();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 380 }} elevation={3}>
        <Box sx={{ textAlign: 'right', mb: 1 }}>
          <Button size="small" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>
            {lang === 'th' ? 'EN' : 'ไทย'}
          </Button>
        </Box>
        <Typography variant="h5" fontWeight={700} textAlign="center" mb={1}>
          {t('login.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
          {t('login.subtitle')}
        </Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label={t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? '…' : t('login.submit')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
