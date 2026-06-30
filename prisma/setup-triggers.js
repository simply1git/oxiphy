const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Setting up TSDB triggers in Neon...");

  // 1. Function to update HourlyAggregate
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_hourly_aggregate()
    RETURNS TRIGGER AS $$
    DECLARE
      current_hour TIMESTAMP;
    BEGIN
      current_hour := date_trunc('hour', NEW.timestamp);

      INSERT INTO "HourlyAggregate" (
        "hour", 
        "pm25Avg", "pm25Min", "pm25Max", 
        "pm10Avg", "pm10Min", "pm10Max", 
        "co2Avg", "co2Min", "co2Max", 
        "vocAvg", "vocMin", "vocMax", 
        "tempAvg", "tempMin", "tempMax", 
        "humAvg", "humMin", "humMax", 
        "readingCount"
      )
      VALUES (
        current_hour,
        NEW.pm25, NEW.pm25, NEW.pm25,
        NEW.pm10, NEW.pm10, NEW.pm10,
        NEW.co2, NEW.co2, NEW.co2,
        NEW.voc, NEW.voc, NEW.voc,
        NEW.temperature, NEW.temperature, NEW.temperature,
        NEW.humidity, NEW.humidity, NEW.humidity,
        1
      )
      ON CONFLICT ("hour") DO UPDATE SET
        "pm25Avg" = ("HourlyAggregate"."pm25Avg" * "HourlyAggregate"."readingCount" + NEW.pm25) / ("HourlyAggregate"."readingCount" + 1),
        "pm25Min" = LEAST("HourlyAggregate"."pm25Min", NEW.pm25),
        "pm25Max" = GREATEST("HourlyAggregate"."pm25Max", NEW.pm25),

        "pm10Avg" = ("HourlyAggregate"."pm10Avg" * "HourlyAggregate"."readingCount" + NEW.pm10) / ("HourlyAggregate"."readingCount" + 1),
        "pm10Min" = LEAST("HourlyAggregate"."pm10Min", NEW.pm10),
        "pm10Max" = GREATEST("HourlyAggregate"."pm10Max", NEW.pm10),

        "co2Avg" = ("HourlyAggregate"."co2Avg" * "HourlyAggregate"."readingCount" + NEW.co2) / ("HourlyAggregate"."readingCount" + 1),
        "co2Min" = LEAST("HourlyAggregate"."co2Min", NEW.co2),
        "co2Max" = GREATEST("HourlyAggregate"."co2Max", NEW.co2),

        "vocAvg" = ("HourlyAggregate"."vocAvg" * "HourlyAggregate"."readingCount" + NEW.voc) / ("HourlyAggregate"."readingCount" + 1),
        "vocMin" = LEAST("HourlyAggregate"."vocMin", NEW.voc),
        "vocMax" = GREATEST("HourlyAggregate"."vocMax", NEW.voc),

        "tempAvg" = ("HourlyAggregate"."tempAvg" * "HourlyAggregate"."readingCount" + NEW.temperature) / ("HourlyAggregate"."readingCount" + 1),
        "tempMin" = LEAST("HourlyAggregate"."tempMin", NEW.temperature),
        "tempMax" = GREATEST("HourlyAggregate"."tempMax", NEW.temperature),

        "humAvg" = ("HourlyAggregate"."humAvg" * "HourlyAggregate"."readingCount" + NEW.humidity) / ("HourlyAggregate"."readingCount" + 1),
        "humMin" = LEAST("HourlyAggregate"."humMin", NEW.humidity),
        "humMax" = GREATEST("HourlyAggregate"."humMax", NEW.humidity),

        "readingCount" = "HourlyAggregate"."readingCount" + 1;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("-> Created update_hourly_aggregate function");

  // 2. Trigger for HourlyAggregate
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS telemetry_hourly_trigger ON "Telemetry";`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER telemetry_hourly_trigger
    AFTER INSERT ON "Telemetry"
    FOR EACH ROW
    EXECUTE FUNCTION update_hourly_aggregate();
  `);
  console.log("-> Created telemetry_hourly_trigger");

  // 3. Function to update DailyAggregate
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_daily_aggregate()
    RETURNS TRIGGER AS $$
    DECLARE
      current_day TIMESTAMP;
    BEGIN
      current_day := date_trunc('day', NEW.timestamp);

      INSERT INTO "DailyAggregate" (
        "date", 
        "pm25Avg", "pm25Min", "pm25Max", 
        "pm10Avg", "pm10Min", "pm10Max", 
        "co2Avg", "co2Min", "co2Max", 
        "vocAvg", "vocMin", "vocMax", 
        "tempAvg", "tempMin", "tempMax", 
        "humAvg", "humMin", "humMax", 
        "readingCount"
      )
      VALUES (
        current_day,
        NEW.pm25, NEW.pm25, NEW.pm25,
        NEW.pm10, NEW.pm10, NEW.pm10,
        NEW.co2, NEW.co2, NEW.co2,
        NEW.voc, NEW.voc, NEW.voc,
        NEW.temperature, NEW.temperature, NEW.temperature,
        NEW.humidity, NEW.humidity, NEW.humidity,
        1
      )
      ON CONFLICT ("date") DO UPDATE SET
        "pm25Avg" = ("DailyAggregate"."pm25Avg" * "DailyAggregate"."readingCount" + NEW.pm25) / ("DailyAggregate"."readingCount" + 1),
        "pm25Min" = LEAST("DailyAggregate"."pm25Min", NEW.pm25),
        "pm25Max" = GREATEST("DailyAggregate"."pm25Max", NEW.pm25),

        "pm10Avg" = ("DailyAggregate"."pm10Avg" * "DailyAggregate"."readingCount" + NEW.pm10) / ("DailyAggregate"."readingCount" + 1),
        "pm10Min" = LEAST("DailyAggregate"."pm10Min", NEW.pm10),
        "pm10Max" = GREATEST("DailyAggregate"."pm10Max", NEW.pm10),

        "co2Avg" = ("DailyAggregate"."co2Avg" * "DailyAggregate"."readingCount" + NEW.co2) / ("DailyAggregate"."readingCount" + 1),
        "co2Min" = LEAST("DailyAggregate"."co2Min", NEW.co2),
        "co2Max" = GREATEST("DailyAggregate"."co2Max", NEW.co2),

        "vocAvg" = ("DailyAggregate"."vocAvg" * "DailyAggregate"."readingCount" + NEW.voc) / ("DailyAggregate"."readingCount" + 1),
        "vocMin" = LEAST("DailyAggregate"."vocMin", NEW.voc),
        "vocMax" = GREATEST("DailyAggregate"."vocMax", NEW.voc),

        "tempAvg" = ("DailyAggregate"."tempAvg" * "DailyAggregate"."readingCount" + NEW.temperature) / ("DailyAggregate"."readingCount" + 1),
        "tempMin" = LEAST("DailyAggregate"."tempMin", NEW.temperature),
        "tempMax" = GREATEST("DailyAggregate"."tempMax", NEW.temperature),

        "humAvg" = ("DailyAggregate"."humAvg" * "DailyAggregate"."readingCount" + NEW.humidity) / ("DailyAggregate"."readingCount" + 1),
        "humMin" = LEAST("DailyAggregate"."humMin", NEW.humidity),
        "humMax" = GREATEST("DailyAggregate"."humMax", NEW.humidity),

        "readingCount" = "DailyAggregate"."readingCount" + 1;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("-> Created update_daily_aggregate function");

  // 4. Trigger for DailyAggregate
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS telemetry_daily_trigger ON "Telemetry";`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER telemetry_daily_trigger
    AFTER INSERT ON "Telemetry"
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_aggregate();
  `);
  console.log("-> Created telemetry_daily_trigger");

  console.log("Successfully created TSDB Continuous Aggregates triggers!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
