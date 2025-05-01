# Program to communicate data to and from a Raspberry Pi equipped with various sensors
# Sends and recieves messages using the MQTT protocol
# Controls actuators in a houseplant environment, such as a plant light (represented by LED)
# and water pumps, represented by microservos

from gpiozero import LED
import paho.mqtt.client as mqtt
import smbus
from gpiozero import PWMOutputDevice
import pigpio
import os, time
import lgpio
from time import sleep
import busio
import digitalio
import board
import adafruit_mcp3xxx.mcp3008 as MCP
from adafruit_mcp3xxx.analog_in import AnalogIn

#   GPIO PINS:  
temperatureDatePin = 2
temperatureClockPin = 3
ledPin = 23 
microservoPin = 18  #hardware PWM

# Other constants:
TOPIC_STEM = 'cs326/plantMonitor/'
TOPIC_OUT = 'plantMonitorOut'
PORT = 1883
QOS = 0
KEEPALIVE = 60
BROKER = 'iot.cs.calvin.edu'
BROKER_AUTHENTICATION = True 
USERNAME = 'cs326'
PASSWORD = 'piot'
I2CBUS = 1      # I2C bus number
I2CADDRESS = 0x48   # TC74 I2C bus address
DELAY = 10000000000

SAMPLE_TIME = 0.100
# create the spi bus
spi = busio.SPI(clock=board.SCK, MISO=board.MISO, MOSI=board.MOSI)
# create the cs (chip select)
cs = digitalio.DigitalInOut(board.D5)
# create the mcp object
mcp = MCP.MCP3008(spi, cs)
#SERVO = Servo(16)
lightChannel = AnalogIn(mcp, MCP.P0)
moistureChannel = AnalogIn(mcp, MCP.P1)
light = LED(ledPin)
pi = pigpio.pi()   
# Connect to I2C bus
bus = smbus.SMBus(I2CBUS)
t1 = time.time_ns()

moistureChannels = [AnalogIn(mcp, MCP.P1), AnalogIn(mcp, MCP.P2), AnalogIn(mcp, MCP.P3), AnalogIn(mcp, MCP.P4)]

""" [0]plant_name, [1]moistureChannel, [2]servoPin """
plantData = [['Keanu_Leaves', moistureChannels[0], 18],['Justin_Branches', moistureChannels[1], 18]]
numPlants = len(plantData)

if not pi.connected:
    exit(0)
pi.set_PWM_frequency(microservoPin,50);   #set PWM frequency to 50Hz

# Callback when client receives a message from the broker
def on_message(client, data, msg):
    message_topic = msg.topic.split('/')
    plant_name = message_topic[2]
    #SPLIT INTO SECTIONS
    if message_topic[3] == 'in':
        client.publish(TOPIC_OUT, 'seen')
        message = msg.payload.decode()
        if message.startswith("pump_on_"):
            volume = float(message.split('_')[2])
            volume = int(volume)
            message = "pump_on"
        match message:
            case "turn_light_on":
                light.on()
            case "turn_light_off":
                light.off()
            case "pump_on":
                i = 0
                while i < volume:
                    pi.set_servo_pulsewidth(microservoPin, 1100)
                    time.sleep(0.5)
                    pi.set_servo_pulsewidth(microservoPin, 1900)
                    time.sleep(1)
                    i += 1
            case "set_servo_left":
                # SERVO.value = -1
                pi.set_servo_pulsewidth(microservoPin, 1100)
            case "set_servo_center":
                # SERVO.value = 0
                pi.set_servo_pulsewidth(microservoPin, 1500)
            case "set_servo_right":
                # SERVO.value = 1
                pi.set_servo_pulsewidth(microservoPin, 1900)
            
# Callback when a connection has been established with the MQTT broker
def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f'Connected to {BROKER} successfully.')
    else:
        print(f'Connection to {BROKER} failed. Return code={rc}')

# Setup MQTT client and callbacks 
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

if BROKER_AUTHENTICATION:
    client.username_pw_set(USERNAME, password=PASSWORD)
client.on_connect = on_connect
client.on_message = on_message

# Connect to MQTT broker and subscribe to the button topic
client.connect(BROKER, PORT, KEEPALIVE)
client.subscribe(f"{TOPIC_STEM}#", qos=QOS)

try:
    while True:
        t2 = time.time_ns()
        if (t2 - t1) > DELAY:
            temperature = bus.read_byte(I2CADDRESS)
            lightvalue = lightChannel.value>>6
            i = 0
            while i < numPlants:
                currentTopic = f"{TOPIC_STEM}{plantData[i][0]}/out"
                client.publish(currentTopic, f'TIME: {t2}')
                client.publish(currentTopic, f'TEMPERATURE: {temperature}')
                client.publish(currentTopic, f'LIGHT: {lightvalue}')
                client.publish(currentTopic, f'MOISTURE: {moistureChannels[i].value>>6}')
                i += 1
            i = 0
            t1 = time.time_ns()
        client.loop()

except KeyboardInterrupt:
    client.disconnect()
    bus.close()
    print('Done')