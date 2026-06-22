import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogActions, Button, Box, CircularProgress, Typography } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

// กล้องในแอป (getUserMedia) — ถ่ายรูปเท่านั้น ไม่มี option เลือกไฟล์
export default function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) return;
    setErr('');
    setReady(false);
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('อุปกรณ์ไม่รองรับกล้อง');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setErr('เปิดกล้องไม่ได้: ' + (e as Error).message + ' (ต้องอนุญาตกล้อง + ใช้ HTTPS)');
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (b) => {
        if (b) onCapture(b);
        stop();
        onClose();
      },
      'image/jpeg',
      0.9,
    );
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 1, textAlign: 'center' }}>
        {err ? (
          <Typography color="error" sx={{ p: 2 }}>{err}</Typography>
        ) : (
          <Box sx={{ position: 'relative', minHeight: 240 }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000' }} />
            {!ready && <CircularProgress sx={{ position: 'absolute', top: '45%', left: '47%' }} />}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>ยกเลิก</Button>
        <Button variant="contained" startIcon={<CameraAltIcon />} onClick={capture} disabled={!ready || !!err}>
          ถ่ายรูป
        </Button>
      </DialogActions>
    </Dialog>
  );
}
