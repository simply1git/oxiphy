import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Basic validation
    if (
      typeof data.pm25 !== 'number' ||
      typeof data.pm10 !== 'number' ||
      typeof data.voc !== 'number' ||
      typeof data.temperature !== 'number' ||
      typeof data.humidity !== 'number' ||
      typeof data.co2 !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const telemetry = await prisma.telemetry.create({
      data: {
        pm25: data.pm25,
        pm10: data.pm10,
        voc: data.voc,
        temperature: data.temperature,
        humidity: data.humidity,
        co2: data.co2,
      },
    });

    return NextResponse.json({ success: true, data: telemetry }, { status: 201 });
  } catch (error) {
    console.error('Error saving telemetry:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const history = await prisma.telemetry.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
