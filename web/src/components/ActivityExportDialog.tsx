import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { exportTableToPdf } from '../utils/exportPdf';

interface ActivityExportDialogProps {
  open: boolean;
  onClose: () => void;
  employees?: Array<{ id: string; name: string }>;
  tableId: string;
  filename: string;
}

export function ActivityExportDialog({
  open,
  onClose,
  employees = [],
  tableId,
  filename,
}: ActivityExportDialogProps) {
  const [exportType, setExportType] = useState<'all' | 'individual'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const element = document.getElementById(tableId);
      if (!element) {
        alert('Table not found for export');
        return;
      }

      let title = 'Activity Report';
      let exportFilename = filename;

      if (exportType === 'individual' && selectedEmployee) {
        const emp = employees.find(e => e.id === selectedEmployee);
        if (emp) {
          title = `Activity Report - ${emp.name}`;
          exportFilename = `${filename}-${emp.name.replace(/\s+/g, '-')}`;

          // Filter table to show only selected employee
          const originalRows = element.querySelectorAll('tbody tr');
          originalRows.forEach(row => {
            const employeeCell = row.querySelector('td:first-child');
            if (employeeCell && !employeeCell.textContent?.includes(emp.name)) {
              (row as HTMLElement).style.display = 'none';
            }
          });
        }
      }

      // Export PDF
      await exportTableToPdf(tableId, exportFilename, title);

      // Restore all rows visibility
      const allRows = element.querySelectorAll('tbody tr');
      allRows.forEach(row => {
        (row as HTMLElement).style.display = '';
      });

      onClose();
    } catch (error) {
      alert('Error exporting PDF: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const canExport = exportType === 'all' || (exportType === 'individual' && selectedEmployee);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Activity Report as PDF</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <div>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Export Type</Typography>
            <RadioGroup
              value={exportType}
              onChange={(e) => {
                setExportType(e.target.value as 'all' | 'individual');
                setSelectedEmployee('');
              }}
            >
              <FormControlLabel
                value="all"
                control={<Radio />}
                label="Export All Activities"
              />
              <FormControlLabel
                value="individual"
                control={<Radio />}
                label="Export Individual Person"
              />
            </RadioGroup>
          </div>

          {exportType === 'individual' && (
            <FormControl fullWidth>
              <InputLabel>Select Employee</InputLabel>
              <Select
                value={selectedEmployee}
                label="Select Employee"
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {employees.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Alert severity="info">
            {exportType === 'all'
              ? 'PDF will include all activities in the report'
              : 'PDF will include only the selected person\'s activities'}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={!canExport || loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Exporting...' : 'Export PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
