import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateAQI } from '@/lib/aqi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 30; // Default to 30 days

    const dailyData = await prisma.dailyAggregate.findMany({
      orderBy: { date: 'desc' },
      take: limit,
    });

    const dataWithAQI = dailyData.map(row => {
      const aqiResult = calculateAQI(row.pm25Avg, row.pm10Avg);
      return {
        ...row,
        aqiAvg: aqiResult.aqi,
        aqiLevel: aqiResult.level
      };
    });

    return NextResponse.json(dataWithAQI);
  } catch (error) {
    console.error('Error fetching daily aggregates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
