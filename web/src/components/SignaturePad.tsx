import { useRef, useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  label?: string;
}

export function SignaturePad({ onSave, onCancel, label = 'Sign here' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  };

  const stopDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    if (!canvasRef.current || !hasStrokes) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" mb={0.5} display="block">{label}</Typography>
      <Box sx={{ border: '1.5px dashed #94A3B8', borderRadius: 1, bgcolor: '#fff', position: 'relative', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          style={{ width: '100%', height: 160, cursor: 'crosshair', display: 'block', borderRadius: 4 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        <Typography variant="caption" sx={{ position: 'absolute', bottom: 4, left: 8, color: '#CBD5E1', pointerEvents: 'none' }}>
          {hasStrokes ? '' : 'Draw your signature here'}
        </Typography>
      </Box>
      <Box display="flex" gap={1} mt={1}>
        <Button size="small" startIcon={<Delete />} onClick={clear} color="error" variant="outlined">Clear</Button>
        <Box flex={1} />
        <Button size="small" onClick={onCancel}>Cancel</Button>
        <Button size="small" variant="contained" startIcon={<Edit />} onClick={save} disabled={!hasStrokes}>
          Confirm Signature
        </Button>
      </Box>
    </Box>
  );
}
