import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

const MONTH_TH_FULL = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const VISIT_TYPE_TH: Record<string,string> = { site_visit:'Site Visit', follow_up:'Follow-up', training:'Training', new_agency:'New Agency' };
const DOC_TITLE: Record<string,string> = {
  sva:'SITE VISIT ASSIGNMENT', svr:'SITE VISIT COMPLETION REPORT', mpa:'MONTHLY PERFORMANCE ACKNOWLEDGEMENT',
};

interface Doc {
  id: string; docType: string; docNumber?: string; month: number; year: number;
  version: number; status: string; companyName: string; declaration?: string; notes?: string;
  kpiSiteVisit?: number; kpiFollowup?: number; kpiNewAgency?: number; kpiTraining?: number; kpiSales?: number;
  actualSiteVisit?: number; actualFollowup?: number; actualNewAgency?: number; actualSales?: number;
  workingDays?: number; leaveDays?: number; gpsCompliancePct?: number; photoCompliancePct?: number;
  supervisorScore?: number; supervisorComment?: string; supervisorPlan?: string; employeeComment?: string;
  employee: { name: string; code: string; position: string; zone?: string; team?: { name: string } };
  supervisor?: { name: string };
  closer?: { name: string };
  approvedBy?: { name: string };
  createdBy: { name: string };
  approvedAt?: string; createdAt: string;
  rows: Array<{ id: string; rowType: string; sortOrder: number; visitDate?: string; visitTime?: string;
    agencyName?: string; contactPerson?: string; province?: string; visitType?: string;
    priority?: string; status?: string; result?: string;
    kpiName?: string; kpiTarget?: number; kpiActual?: number; activityName?: string; activityDone?: boolean; note?: string }>;
  signatures: Array<{ signerType: string; signedAt: string; signedBy: { name: string }; signatureData: string; revokedAt?: string }>;
}

function cell(txt: string | undefined, w?: string) {
  return <td style={{ border: '1px solid #333', padding: '4px 8px', fontSize: 11, width: w }}>{txt ?? '—'}</td>;
}

export default function DocPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<Doc>(`/docs/${id}`).then(r => { setDoc(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (doc) setTimeout(() => window.print(), 500);
  }, [doc]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>;
  if (!doc) return <div style={{ padding: 40 }}>ไม่พบเอกสาร</div>;

  const scheduleRows = doc.rows.filter(r => r.rowType === 'schedule').sort((a, b) => a.sortOrder - b.sortOrder);
  const kpiRows = doc.rows.filter(r => r.rowType === 'kpi');
  const activityRows = doc.rows.filter(r => r.rowType === 'activity');
  const signedMap = new Map(doc.signatures.filter(s => !s.revokedAt).map(s => [s.signerType, s]));
  const thaiYear = doc.year + 543;

  return (
    <div id="print-root" style={{ fontFamily: 'Sarabun, Arial, sans-serif', fontSize: 12, color: '#000', padding: '20px 40px', maxWidth: 800, margin: '0 auto' }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm; }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #print-root { padding: 0; max-width: 100%; }
          .page-break { page-break-before: always; }
        }
        table { border-collapse: collapse; width: 100%; }
        th { background: #1e3a5f; color: #fff; padding: 5px 8px; font-size: 11px; border: 1px solid #333; }
        .sig-box { border-bottom: 1px solid #333; min-height: 60px; display: inline-block; width: 100%; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{ textAlign: 'right', marginBottom: 16 }}>
        <button onClick={() => window.print()} style={{ background: '#1e3a5f', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
          🖨️ พิมพ์ / Export PDF
        </button>
      </div>

      {/* Header */}
      <table style={{ marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '60%', paddingBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{doc.companyName}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f', marginTop: 4 }}>{DOC_TITLE[doc.docType]}</div>
            </td>
            <td style={{ width: '40%', textAlign: 'right', fontSize: 11 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['เลขที่', doc.docNumber ?? '—'],
                    ['เดือน', `${MONTH_TH_FULL[doc.month]} ${thaiYear}`],
                    ['Version', `${doc.year}-${String(doc.month).padStart(2,'0')} V${doc.version}`],
                    ['วันที่สร้าง', new Date(doc.createdAt).toLocaleDateString('th-TH')],
                    ['วันที่อนุมัติ', doc.approvedAt ? new Date(doc.approvedAt).toLocaleDateString('th-TH') : '—'],
                    ['อนุมัติโดย', doc.approvedBy?.name ?? '—'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ border: '1px solid #333', padding: '2px 6px', background: '#f0f4f8', fontWeight: 600, width: 110 }}>{k}</td>
                      <td style={{ border: '1px solid #333', padding: '2px 6px' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Employee Info */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ข้อมูลพนักงาน</div>
      <table style={{ marginBottom: 12 }}>
        <tbody>
          <tr>
            {[['รหัสพนักงาน', doc.employee.code], ['ชื่อ-สกุล', doc.employee.name], ['ตำแหน่ง', doc.employee.position], ['ทีม', doc.employee.team?.name ?? '—']].map(([k, v]) => (
              <>
                <td key={`k${k}`} style={{ border: '1px solid #333', background: '#f0f4f8', padding: '4px 8px', fontWeight: 600, width: 100 }}>{k}</td>
                <td key={`v${k}`} style={{ border: '1px solid #333', padding: '4px 8px', width: 120 }}>{v}</td>
              </>
            ))}
          </tr>
          <tr>
            {[['โซน', doc.employee.zone ?? '—'], ['หัวหน้างาน', doc.supervisor?.name ?? '—'], ['Closer', doc.closer?.name ?? '—'], ['วันทำงาน', doc.workingDays ?? '—']].map(([k, v]) => (
              <>
                <td key={`k${k}`} style={{ border: '1px solid #333', background: '#f0f4f8', padding: '4px 8px', fontWeight: 600, width: 100 }}>{k}</td>
                <td key={`v${k}`} style={{ border: '1px solid #333', padding: '4px 8px', width: 120 }}>{v}</td>
              </>
            ))}
          </tr>
        </tbody>
      </table>

      {/* KPI Section */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>KPI ประจำเดือน</div>
      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>KPI</th><th>เป้าหมาย</th>
            {doc.docType !== 'sva' && <><th>จริง</th><th>Achievement</th></>}
          </tr>
        </thead>
        <tbody>
          {doc.docType === 'mpa' && kpiRows.length > 0 ? kpiRows.map(row => {
            const pct = row.kpiTarget ? Math.round(((row.kpiActual ?? 0) / row.kpiTarget) * 100) : 0;
            return (
              <tr key={row.id}>
                {cell(row.kpiName)}{cell(String(row.kpiTarget ?? '—'))}{cell(String(row.kpiActual ?? '—'))}{cell(`${pct}%`)}
              </tr>
            );
          }) : [
            ['Site Visit', doc.kpiSiteVisit, doc.actualSiteVisit],
            ['Follow-up', doc.kpiFollowup, doc.actualFollowup],
            ['New Agency', doc.kpiNewAgency, doc.actualNewAgency],
            ['Training', doc.kpiTraining, undefined],
            ['Sales Target', doc.kpiSales, doc.actualSales],
          ].filter(([, t]) => t != null).map(([label, target, actual]) => {
            const pct = target && actual != null ? Math.round((Number(actual) / Number(target)) * 100) : null;
            return (
              <tr key={String(label)}>
                {cell(String(label))}{cell(String(target ?? '—'))}
                {doc.docType !== 'sva' && <>{cell(String(actual ?? '—'))}{cell(pct != null ? `${pct}%` : '—')}</>}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Schedule (SVA/SVR) */}
      {(doc.docType === 'sva' || doc.docType === 'svr') && scheduleRows.length > 0 && (
        <>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ตารางปฏิบัติงาน</div>
          <table style={{ marginBottom: 12, fontSize: 10.5 }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>วันที่</th><th style={{ width: 50 }}>เวลา</th>
                <th>Agency</th><th>ผู้ติดต่อ</th><th>จังหวัด</th>
                <th style={{ width: 80 }}>ประเภท</th><th style={{ width: 65 }}>Priority</th>
                <th style={{ width: 80 }}>สถานะ</th>
                {doc.docType === 'svr' && <th>ผลการเยี่ยม</th>}
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map(row => (
                <tr key={row.id}>
                  {cell(row.visitDate ? new Date(row.visitDate).toLocaleDateString('th-TH') : '—')}
                  {cell(row.visitTime)}
                  {cell(row.agencyName)}
                  {cell(row.contactPerson)}
                  {cell(row.province)}
                  {cell(VISIT_TYPE_TH[row.visitType ?? ''] ?? row.visitType)}
                  {cell(row.priority)}
                  {cell(row.status)}
                  {doc.docType === 'svr' && cell(row.result)}
                  {cell(row.note)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Responsibilities (SVA) */}
      {doc.docType === 'sva' && (
        <>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ความรับผิดชอบของพนักงาน</div>
          <div style={{ border: '1px solid #333', padding: '8px 12px', marginBottom: 12, fontSize: 11 }}>
            {['โทร Confirm ก่อนเข้าเยี่ยม', 'Check-in ผ่าน GPS', 'ถ่ายรูปอย่างน้อย 3 รูป',
              'บันทึกผลการเข้าเยี่ยม', 'สร้าง Follow-up Task', 'ปิดงานภายในวันเดียวกัน'].map(r => (
              <div key={r}>□ {r}</div>
            ))}
          </div>
        </>
      )}

      {/* SVR Activity */}
      {doc.docType === 'svr' && activityRows.length > 0 && (
        <>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>Activity Summary</div>
          <table style={{ marginBottom: 12 }}>
            <thead><tr><th>กิจกรรม</th><th style={{ width: 60 }}>ดำเนินการ</th></tr></thead>
            <tbody>
              {activityRows.map(row => (
                <tr key={row.id}>{cell(row.activityName)}<td style={{ border: '1px solid #333', padding: '4px 8px', textAlign: 'center' }}>{row.activityDone ? '✓' : '□'}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Evaluations (SVR/MPA) */}
      {doc.supervisorComment && (
        <>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ความเห็นหัวหน้างาน</div>
          <div style={{ border: '1px solid #333', padding: '8px 12px', marginBottom: 8, fontSize: 11 }}>
            {doc.supervisorScore != null && <div>คะแนน: <strong>{doc.supervisorScore}/100</strong></div>}
            <div>{doc.supervisorComment}</div>
            {doc.supervisorPlan && <div style={{ marginTop: 4 }}>แผนพัฒนา: {doc.supervisorPlan}</div>}
          </div>
        </>
      )}

      {/* Notes */}
      {doc.notes && (
        <div style={{ border: '1px solid #333', padding: '8px 12px', marginBottom: 12, fontSize: 11 }}>
          <strong>หมายเหตุ:</strong> {doc.notes}
        </div>
      )}

      {/* Declaration */}
      {doc.declaration && (
        <div style={{ border: '1px solid #333', padding: '10px 16px', marginBottom: 16, fontStyle: 'italic', fontSize: 12, textAlign: 'center' }}>
          "{doc.declaration}"
        </div>
      )}

      {/* Signatures */}
      <div style={{ background: '#1e3a5f', color: '#fff', padding: '5px 10px', fontWeight: 700, marginBottom: 8, fontSize: 12 }}>ลายเซ็น</div>
      <table style={{ marginBottom: 16 }}>
        <tbody>
          <tr>
            {['employee','supervisor','manager'].map(type => {
              const sig = signedMap.get(type);
              const label = type === 'employee' ? 'ผู้ปฏิบัติงาน' : type === 'supervisor' ? 'หัวหน้างาน' : 'ผู้จัดการ';
              return (
                <td key={type} style={{ border: '1px solid #333', padding: 12, width: '33%', textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{label}</div>
                  {sig ? (
                    <>
                      <img src={sig.signatureData} alt="sig" style={{ height: 50, maxWidth: '80%', objectFit: 'contain', display: 'block', margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 10, color: '#555' }}>{sig.signedBy.name}</div>
                      <div style={{ fontSize: 10, color: '#555' }}>วันที่: {new Date(sig.signedAt).toLocaleDateString('th-TH')}</div>
                    </>
                  ) : (
                    <>
                      <div className="sig-box" style={{ height: 50 }} />
                      <div style={{ marginTop: 6, fontSize: 10 }}>ชื่อ: __________________________</div>
                      <div style={{ fontSize: 10 }}>วันที่: _________________________</div>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      {/* QR Code placeholder */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <div style={{ fontSize: 9, color: '#999', textAlign: 'right' }}>
          <div>เอกสารอ้างอิง: {doc.docNumber}</div>
          <div>Version: {doc.version} | สถานะ: {doc.status}</div>
          <div>สร้างโดย: {doc.createdBy.name}</div>
          <div>URL: /docs/{doc.id}</div>
        </div>
        {/* Simple QR placeholder — real QR requires qrcode library */}
        <div style={{ width: 64, height: 64, border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#999', flexDirection: 'column' }}>
          <div>QR</div><div>Code</div>
        </div>
      </div>
    </div>
  );
}
