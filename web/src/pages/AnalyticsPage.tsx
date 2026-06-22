import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { api, errMsg } from '../api/client';
import { useT } from '../i18n';

interface Insight {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

const sevColor: Record<string, 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};
const sevLabel: Record<string, string> = { high: 'สูง', medium: 'กลาง', low: 'ต่ำ' };

export default function AnalyticsPage() {
  const { t } = useT();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/analytics/insights');
      setInsights(data.insights);
      setGeneratedAt(data.generatedAt);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          {t('an.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={run}
          disabled={loading}
        >
          {loading ? t('an.running') : t('an.run')}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        {t('an.sub')}
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {generatedAt && (
        <Typography variant="caption" color="text.secondary">
          วิเคราะห์เมื่อ {new Date(generatedAt).toLocaleString('th-TH')}
        </Typography>
      )}

      <Stack spacing={1.5} mt={1}>
        {insights?.map((ins, i) => (
          <Paper key={i} sx={{ p: 2, borderLeft: 4, borderColor: `${sevColor[ins.severity]}.main` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h6" fontWeight={700}>
                {ins.title}
              </Typography>
              <Chip size="small" color={sevColor[ins.severity]} label={sevLabel[ins.severity]} />
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {ins.detail}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'success.main' }}>
              💡 {ins.recommendation}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
