import { Button } from '@mui/material';
import { Download } from '@mui/icons-material';
import { exportTableToPdf } from '../utils/exportPdf';

interface ExportPdfButtonProps {
  tableId: string;
  filename: string;
  title?: string;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
}

export function ExportPdfButton({
  tableId,
  filename,
  title,
  variant = 'outlined',
  size = 'small',
}: ExportPdfButtonProps) {
  const handleExport = () => {
    exportTableToPdf(tableId, filename, title);
  };

  return (
    <Button
      size={size}
      variant={variant}
      startIcon={<Download />}
      onClick={handleExport}
    >
      Export PDF
    </Button>
  );
}
