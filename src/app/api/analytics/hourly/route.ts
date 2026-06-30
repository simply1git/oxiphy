import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateAQI } from '@/lib/aqi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 24; // Default to 24 hours

    const hourlyData = await prisma.hourlyAggregate.findMany({
      orderBy: { hour: 'desc' },
      take: limit,
    });

    // We calculate the AQI dynamically for the API response based on the average PM values
    const dataWithAQI = hourlyData.map(row => {
      const aqiResult = calculateAQI(row.pm25Avg, row.pm10Avg);
      return {
        ...row,
        aqiAvg: aqiResult.aqi,
        aqiLevel: aqiResult.level
      };
    });

    return NextResponse.json(dataWithAQI);
  } catch (error) {
    console.error('Error fetching hourly aggregates:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
