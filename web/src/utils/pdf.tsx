import { useState, type RefObject } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useT } from '../i18n';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// แปลง DOM element เป็น PDF (capture เป็นรูป — รองรับฟอนต์ไทย) แล้วดาวน์โหลด
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    ignoreElements: (n) => n.classList?.contains('no-pdf'),
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(filename);
}

export function PdfExportButton({
  targetRef,
  filename,
  label = 'Export PDF',
}: {
  targetRef: RefObject<HTMLElement>;
  filename: string;
  label?: string;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(targetRef.current, filename);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(t('pdf.exportError') + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      className="no-pdf"
      variant="outlined"
      size="small"
      startIcon={busy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
      onClick={run}
      disabled={busy}
    >
      {busy ? t('pdf.generating') : label}
    </Button>
  );
}
