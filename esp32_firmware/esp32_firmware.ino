#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ModbusMaster.h>

// Wi-Fi credentials (Home Network)
const char* ssid = "fablabnmamit";
const char* password = "JAISHREERAM";

// Cloud Vercel Backend URL (for Historical Logging)
const char* serverUrl = "https://oxiphy.vercel.app/api/telemetry";

// MQTT Broker Setup (for Live UI Updates)
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* mqtt_topic = "oxiphy/telemetry/live";

// Modbus setup
#define MAX485_RE_NEG  4
#define MAX485_DE      4
#define RX_PIN         16
#define TX_PIN         17

ModbusMaster node;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastHttpPost = 0;
const unsigned long HTTP_INTERVAL = 30000; // Post to Vercel DB every 30 seconds

void preTransmission() {
  digitalWrite(MAX485_RE_NEG, 1);
}

void postTransmission() {
  digitalWrite(MAX485_RE_NEG, 0);
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "OxiphyESP32-";
    clientId += String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 2 seconds");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // Setup Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWi-Fi connected!");
  Serial.print("ESP32 IP address: ");
  Serial.println(WiFi.localIP());

  // Setup MQTT
  mqttClient.setServer(mqtt_server, mqtt_port);

  // Setup Modbus pins
  pinMode(MAX485_RE_NEG, OUTPUT);
  pinMode(MAX485_DE, OUTPUT);
  digitalWrite(MAX485_RE_NEG, 0);

  // Setup Serial2 for Modbus RTU
  Serial2.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
  
  Serial.println("System Ready - MQTT + HTTP Mode.");
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  uint8_t result;
  result = node.readHoldingRegisters(1, 9);
  
  if (result == node.ku8MBSuccess) {
    uint16_t pm25 = node.getResponseBuffer(0);
    uint16_t pm10 = node.getResponseBuffer(1);
    uint16_t voc = node.getResponseBuffer(3);
    uint16_t tempRaw = node.getResponseBuffer(4);
    uint16_t humRaw = node.getResponseBuffer(5);
    uint16_t co2 = node.getResponseBuffer(8);

    float temp = tempRaw / 10.0;
    float hum = humRaw / 10.0;

    Serial.printf("PM2.5: %d, PM10: %d, VOC: %d, Temp: %.1f, Hum: %.1f, CO2: %d\n", pm25, pm10, voc, temp, hum, co2);
    
    // Construct JSON Payload
    String jsonPayload = "{";
    jsonPayload += "\"pm25\":" + String(pm25) + ",";
    jsonPayload += "\"pm10\":" + String(pm10) + ",";
    jsonPayload += "\"voc\":" + String(voc) + ",";
    jsonPayload += "\"temperature\":" + String(temp, 1) + ",";
    jsonPayload += "\"humidity\":" + String(hum, 1) + ",";
    jsonPayload += "\"co2\":" + String(co2);
    jsonPayload += "}";

    // 1. FAST LANE: Publish to MQTT instantly (every 2 seconds)
    mqttClient.publish(mqtt_topic, jsonPayload.c_str());

    // 2. SLOW LANE: Post to Vercel DB (every 30 seconds)
    if (millis() - lastHttpPost >= HTTP_INTERVAL) {
      if(WiFi.status() == WL_CONNECTED) {
        WiFiClientSecure httpsClient;
        httpsClient.setInsecure(); // Skip SSL certificate validation for Vercel
        
        HTTPClient http;
        http.begin(httpsClient, serverUrl);
        http.addHeader("Content-Type", "application/json");

        int httpResponseCode = http.POST(jsonPayload);
        if (httpResponseCode > 0) {
          Serial.print("DB Logged, HTTP code: ");
          Serial.println(httpResponseCode);
        } else {
          Serial.print("DB Error: ");
          Serial.println(httpResponseCode);
        }
        http.end();
      }
      lastHttpPost = millis();
    }
  } else {
    Serial.print("Modbus read error: ");
    Serial.println(result, HEX);
  }
  
  // Fast loop for real-time responsiveness
  delay(2000); 
}
