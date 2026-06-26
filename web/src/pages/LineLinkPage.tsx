import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

declare global {
  interface Window {
    liff: {
      init: (cfg: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>;
      closeWindow: () => void;
    };
  }
}

const LIFF_ID = '2010519960-8863VFIr';

type Phase = 'loading' | 'success' | 'error' | 'notoken';

export default function LineLinkPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('กำลังเชื่อมต่อกับ LINE...');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.async = true;
    script.onload = () => run();
    script.onerror = () => { setPhase('error'); setMessage('ไม่สามารถโหลด LINE SDK กรุณาเปิดในแอป LINE'); };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  async function run() {
    try {
      await window.liff.init({ liffId: LIFF_ID });

      if (!window.liff.isLoggedIn()) {
        window.liff.login();
        return;
      }

      const profile = await window.liff.getProfile();
      setDisplayName(profile.displayName);

      // token อยู่ใน liff.state → search param
      const params = new URLSearchParams(window.location.search);
      const token = params.get('liff.state') ?? params.get('token') ?? '';

      if (!token) {
        setPhase('notoken');
        setMessage('ไม่พบ token กรุณาเปิดจากแอป Agency Care แล้วกด "ผูก LINE" ใหม่อีกครั้ง');
        return;
      }

      const res = await fetch('/api/auth/link-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lineUserId: profile.userId }),
      });

      if (res.ok) {
        setPhase('success');
        setMessage('ผูกบัญชี LINE สำเร็จ! ปิดหน้าต่างนี้ได้เลย');
        setTimeout(() => { try { window.liff.closeWindow(); } catch {} }, 2500);
      } else {
        const err = await res.json().catch(() => ({}));
        setPhase('error');
        setMessage((err as { message?: string }).message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    } catch (e) {
      setPhase('error');
      setMessage(String(e));
    }
  }

  return (
    <Box
      display="flex" flexDirection="column" alignItems="center" justifyContent="center"
      minHeight="100vh" p={3} sx={{ background: 'linear-gradient(135deg,#06C755 0%,#00A846 100%)' }}
    >
      <Box
        sx={{
          bgcolor: '#fff', borderRadius: 4, p: 4, maxWidth: 360, width: '100%',
          textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* LINE Logo */}
        <Box sx={{ mb: 2 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="16" fill="#06C755"/>
            <path d="M46 25.6C46 17.6 38.8 11 28 11C17.2 11 10 17.6 10 25.6C10 32.8 16.4 38.8 25.2 39.8L25.6 43.6C25.6 44 26 44.2 26.4 44L31.2 41.2C32.4 41 33.6 40.6 34.8 40.2C41.6 38.2 46 32.4 46 25.6Z" fill="white"/>
            <path d="M23.6 22.8H22.4C22 22.8 21.8 23 21.8 23.4V28.6C21.8 29 22 29.2 22.4 29.2H23.6C24 29.2 24.2 29 24.2 28.6V23.4C24.2 23 24 22.8 23.6 22.8Z" fill="#06C755"/>
            <path d="M33.6 22.8H32.4C32 22.8 31.8 23 31.8 23.4V26.6L29.2 23C29 22.8 28.8 22.8 28.6 22.8H27.4C27 22.8 26.8 23 26.8 23.4V28.6C26.8 29 27 29.2 27.4 29.2H28.6C29 29.2 29.2 29 29.2 28.6V25.4L31.8 29C32 29.2 32.2 29.2 32.4 29.2H33.6C34 29.2 34.2 29 34.2 28.6V23.4C34.2 23 34 22.8 33.6 22.8Z" fill="#06C755"/>
          </svg>
        </Box>

        <Typography variant="h6" fontWeight={700} mb={0.5}>Agency Care × LINE</Typography>
        {displayName && (
          <Typography variant="body2" color="text.secondary" mb={2}>สวัสดี {displayName}</Typography>
        )}

        {phase === 'loading' && (
          <>
            <CircularProgress size={40} sx={{ color: '#06C755', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">{message}</Typography>
          </>
        )}

        {phase === 'success' && (
          <>
            <CheckCircleOutlineIcon sx={{ fontSize: 48, color: '#06C755', mb: 1 }} />
            <Typography variant="body1" fontWeight={600} color="success.main">{message}</Typography>
          </>
        )}

        {(phase === 'error' || phase === 'notoken') && (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 48, color: '#f44336', mb: 1 }} />
            <Typography variant="body2" color="error" mb={2}>{message}</Typography>
            <Button
              variant="outlined" size="small" color="error"
              onClick={() => window.liff?.closeWindow()}
            >
              ปิดหน้าต่าง
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
