import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

interface Stop {
  id: string;
  agencyId: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
}

@Injectable()
export class RouteService {
  constructor(private prisma: PrismaService) {}

  async planRoute(user: RequestUser, params: { date: string; employeeId?: string }) {
    let employeeId = params.employeeId;
    if (user.role === 'sales') {
      const emp = await this.prisma.employee.findUnique({ where: { userId: user.id } });
      if (!emp) throw new ForbiddenException('บัญชีนี้ไม่ได้ผูกกับเซลส์');
      employeeId = emp.id;
    }

    const day = new Date(params.date);
    const plans = await this.prisma.visitPlan.findMany({
      where: {
        planDate: day,
        status: { in: ['pending', 'done'] },
        ...(employeeId ? { employeeId } : {}),
      },
      include: { agency: { select: { id: true, code: true, name: true, latitude: true, longitude: true } } },
    });

    const stops: Stop[] = plans
      .filter((p) => p.agency.latitude != null && p.agency.longitude != null)
      .map((p) => ({
        id: p.id,
        agencyId: p.agency.id,
        code: p.agency.code,
        name: p.agency.name,
        latitude: p.agency.latitude as number,
        longitude: p.agency.longitude as number,
        status: p.status,
      }));

    const skipped = plans.length - stops.length;

    if (stops.length === 0) {
      return { date: params.date, stops: [], totalDistanceKm: 0, skippedNoGps: skipped, mapsUrl: null };
    }

    // จัดลำดับแบบ nearest-neighbor เริ่มจากจุดแรก
    const remaining = [...stops];
    const ordered: Stop[] = [remaining.shift()!];
    let totalMeters = 0;
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((s, i) => {
        const d = distanceMeters(last.latitude, last.longitude, s.latitude, s.longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      totalMeters += bestDist;
      ordered.push(remaining.splice(bestIdx, 1)[0]);
    }

    // Google Maps directions URL
    const origin = `${ordered[0].latitude},${ordered[0].longitude}`;
    const destination = `${ordered[ordered.length - 1].latitude},${ordered[ordered.length - 1].longitude}`;
    const waypoints = ordered
      .slice(1, -1)
      .map((s) => `${s.latitude},${s.longitude}`)
      .join('|');
    const mapsUrl =
      `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${destination}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '');

    return {
      date: params.date,
      stops: ordered.map((s, i) => ({ order: i + 1, ...s })),
      totalDistanceKm: Math.round((totalMeters / 1000) * 10) / 10,
      skippedNoGps: skipped,
      mapsUrl,
    };
  }
}
