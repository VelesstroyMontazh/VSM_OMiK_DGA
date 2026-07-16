import { NextResponse } from 'next/server';
import { db, withRetry, getEmployeeCache, getEmployeeCacheMeta } from '@/lib/db';

export async function GET() {
  try {
    const cache = getEmployeeCache();
    const meta = getEmployeeCacheMeta();
    const totalEmployees = cache?.length ?? 0;

    const dailyRecords = await withRetry(() => db.dailyRecord.findMany());
    const hrEvents = await withRetry(() => db.hrEvent.findMany({ take: 1000, orderBy: { createdAt: 'desc' } }));
    const flightEvents = await withRetry(() => db.flightEvent.findMany({ take: 500, orderBy: { createdAt: 'desc' } }));
    const files = await withRetry(() => db.excelFile.findMany({ orderBy: { loadedAt: 'desc' }, take: 20 }));

    const onSite = dailyRecords.filter(r => r.status === 'на площадке').length;
    const offSite = dailyRecords.filter(r => r.status !== 'на площадке').length;

    // Citizenship distribution from cache
    const citizenshipMap: Record<string, number> = {};
    if (cache && cache.length > 0) {
      for (const emp of cache) {
        const citizenship = String(emp['Гражданство'] || emp['гражданство'] || 'Не указано');
        citizenshipMap[citizenship] = (citizenshipMap[citizenship] || 0) + 1;
      }
    }
    const citizenship = Object.entries(citizenshipMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Site distribution from cache
    const siteMap: Record<string, number> = {};
    if (cache && cache.length > 0) {
      for (const emp of cache) {
        const site = String(emp['Площадка'] || emp['площадка'] || 'Не указана');
        if (site && site !== 'Не указана') siteMap[site] = (siteMap[site] || 0) + 1;
      }
    }
    const sites = Object.entries(siteMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // HR events by month
    const eventsByMonth: Record<string, { hire: number; transfer: number; fire: number }> = {};
    for (const evt of hrEvents) {
      const month = evt.eventDate ? evt.eventDate.substring(3) : 'Не указано';
      if (!eventsByMonth[month]) eventsByMonth[month] = { hire: 0, transfer: 0, fire: 0 };
      if (evt.eventType === 'прием') eventsByMonth[month].hire++;
      else if (evt.eventType === 'перевод') eventsByMonth[month].transfer++;
      else if (evt.eventType === 'увольнение') eventsByMonth[month].fire++;
    }
    const dynamics = Object.entries(eventsByMonth).map(([month, data]) => ({ month, ...data }));

    // Visa risks from daily records
    const visaRisks = dailyRecords.filter(r => {
      const s = r.visaStatus.toLowerCase();
      return s.includes('истек') || s.includes('заканчивает') || s.includes('рис') || s.includes('просроч');
    }).length;

    const onVacation = dailyRecords.filter(r => r.status === 'в отпуске' || r.status === 'командировка').length;

    return NextResponse.json({
      totalEmployees,
      dbLoaded: totalEmployees > 0,
      dbFileName: meta.fileName,
      dbRows: meta.rows,
      onSite,
      offSite,
      onVacation,
      dailyTotal: dailyRecords.length,
      citizenship,
      sites,
      dynamics,
      visaRisks,
      totalEvents: hrEvents.length,
      totalFlights: flightEvents.length,
      recentFiles: files.map(f => ({ id: f.id, name: f.originalName, category: f.category, rows: f.totalRows, size: f.fileSize, loadedAt: f.loadedAt })),
      recentEvents: hrEvents.slice(0, 100).map(e => ({
        id: e.id,
        tabNumber: e.tabNumber,
        fullName: e.fullName,
        eventType: e.eventType,
        eventDate: e.eventDate,
        department: e.department,
        position: e.position,
        basis: e.basis,
      })),
      dailyRecordsList: dailyRecords.slice(0, 200).map(r => ({
        tabNumber: r.tabNumber,
        fullName: r.fullName,
        site: r.site,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error('Overview error:', error);
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}