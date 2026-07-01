import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('firmware') as File | null;
    const version = formData.get('version') as string | null;

    if (!file || !version) {
      return NextResponse.json({ error: 'File and version are required' }, { status: 400 });
    }

    if (!file.name.endsWith('.bin')) {
      return NextResponse.json({ error: 'Only .bin files are allowed' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to database
    const firmware = await prisma.firmware.create({
      data: {
        version: version,
        binData: buffer,
      },
    });

    return NextResponse.json({ success: true, version: firmware.version, id: firmware.id });
  } catch (error) {
    console.error('Firmware upload error:', error);
    return NextResponse.json({ error: 'Failed to upload firmware' }, { status: 500 });
  }
}
