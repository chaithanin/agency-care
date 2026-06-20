// ===== Shared types ระหว่าง api / web =====

export type UserRole = 'admin' | 'manager' | 'sales';
export type AgencyLevel = 'A' | 'B' | 'C' | 'D';
export type AgencyStatus = 'active' | 'inactive';
export type VisitStatus = 'pending' | 'done' | 'postponed' | 'cancelled';
export type PhotoPhase = 'before' | 'during' | 'after';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ความถี่การเข้าเยี่ยมตามระดับ Agency (ครั้ง/เดือน) — ใช้คำนวณ KPI/แผน
export const VISIT_FREQUENCY_PER_MONTH: Record<AgencyLevel, number> = {
  A: 4,
  B: 2,
  C: 1,
  D: 1 / 3, // 1 ครั้ง / 3 เดือน
};

// คำนวณระยะทาง 2 พิกัด (เมตร) — Haversine
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // รัศมีโลก (เมตร)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
