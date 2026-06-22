import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, LinearProgress, Grid, Chip } from '@mui/material';
import { api } from '../api/client';
import { useT } from '../i18n';

interface Pipeline {
  total: number;
  stages: Record<string, number>;
  tiers: Record<string, number>;
}

const STAGE_ORDER = [
  { key: 'new', label: 'ใหม่', color: '#90a4ae' },
  { key: 'prospect', label: 'Prospect', color: '#42a5f5' },
  { key: 'onboarding', label: 'Onboarding', color: '#26a69a' },
  { key: 'active', label: 'Active', color: '#66bb6a' },
  { key: 'grade_a', label: 'Grade A', color: '#ab47bc' },
  { key: 'at_risk', label: 'เสี่ยงหลุด', color: '#ffa726' },
  { key: 'inactive', label: 'ไม่เคลื่อนไหว', color: '#bdbdbd' },
];
const TIER_ORDER = [
  { key: 'platinum', label: 'Platinum', color: 'secondary' as const },
  { key: 'gold', label: 'Gold', color: 'warning' as const },
  { key: 'silver', label: 'Silver', color: 'default' as const },
  { key: 'bronze', label: 'Bronze', color: 'default' as const },
  { key: 'new', label: 'New', color: 'info' as const },
];

export default function PipelinePage() {
  const { t } = useT();
  const [data, setData] = useState<Pipeline | null>(null);

  useEffect(() => {
    api.get('/agencies/pipeline').then((r) => setData(r.data));
  }, []);

  if (!data) return <LinearProgress />;
  const max = Math.max(1, ...STAGE_ORDER.map((s) => data.stages[s.key] ?? 0));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        {t('page.pipeline')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        ภาพรวมความสัมพันธ์ Agency ทั้งหมด {data.total.toLocaleString()} ราย — ปรับ stage/tier ได้ที่หน้า Agency
      </Typography>

      <Grid container spacing={2} mt={0.5}>
        {/* funnel ตาม stage */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              ขั้นความสัมพันธ์ (Pipeline Stage)
            </Typography>
            <Stack spacing={1.5}>
              {STAGE_ORDER.map((s) => {
                const n = data.stages[s.key] ?? 0;
                return (
                  <Box key={s.key}>
                    <Stack direction="row" justifyContent="space-between" mb={0.3}>
                      <Typography variant="body2" fontWeight={600}>{s.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{n.toLocaleString()}</Typography>
                    </Stack>
                    <Box sx={{ height: 22, bgcolor: '#f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(n / max) * 100}%`, bgcolor: s.color, borderRadius: 1, minWidth: n ? 4 : 0 }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        {/* tier distribution */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              ระดับ Tier (ความถี่เยี่ยม)
            </Typography>
            <Stack spacing={1.5}>
              {TIER_ORDER.map((t) => (
                <Stack key={t.key} direction="row" alignItems="center" justifyContent="space-between">
                  <Chip size="small" color={t.color} label={t.label} sx={{ minWidth: 90 }} />
                  <Typography variant="h6" fontWeight={700}>{(data.tiers[t.key] ?? 0).toLocaleString()}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Platinum 4 · Gold 2 · Silver 1 · Bronze 0.5 · New 2 ครั้ง/เดือน
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
