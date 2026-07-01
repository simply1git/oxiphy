import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // Get the latest firmware
    const latestFirmware = await prisma.firmware.findFirst({
      orderBy: {
        uploaded: 'desc',
      },
    });

    if (!latestFirmware) {
      return new NextResponse('No firmware found', { status: 404 });
    }

    // Return the binary data
    return new NextResponse(new Uint8Array(latestFirmware.binData), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="firmware-${latestFirmware.version}.bin"`,
        'x-MD5': 'ignore', // ESP32 HTTPUpdate checks this sometimes
      },
    });
  } catch (error) {
    console.error('Firmware download error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
