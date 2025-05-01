# TERMINAL COMMANDS BEFORE START:
""" 
cd houseplantMonitor
python3 -m venv houseplantMonitor
source houseplantMonitor/bin/activate
sudo service pigpiod start
python3 boardside.py

pip3 install adafruit-circuitpython-mcp3xxx
pip3 install gpiozero
pip3 install pigpio
pip3 install lgpio
pip3 install smbus
"""

# TESTING COMMANDS:
""" 
mosquitto_pub -t cs326/plantMonitor/Keanu_Leaves/in -m "turn_light_on" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/Keanu_Leaves/in -m "turn_light_off" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/Keanu_Leaves/in -m "pump_on_700" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/Samuel_Stems/in -m "pump_on_700" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/Keanu_Leaves/in -m "pump_on_100" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "remove test_name" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "remove Keanu_Leaves" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "remove Samuel_Stems" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "remove Justin_Branches" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "add test_name 0 0 0 0" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "add Justin_Branches 1 0 1 0" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "add Keanu_Leaves 0 0 0 0" -h iot.cs.calvin.edu -u cs326 -P piot
mosquitto_pub -t cs326/plantMonitor/utility -m "add Samuel_Stems 2 0 2 0" -h iot.cs.calvin.edu -u cs326 -P piot

mosquitto_sub -h iot.cs.calvin.edu -t cs326/plantMonitor/Keanu_Leaves/out/# -u cs326 -P piot 
mosquitto_sub -h iot.cs.calvin.edu -t cs326/plantMonitor/+/out/# -u cs326 -P piot 
mosquitto_sub -h iot.cs.calvin.edu -t cs326/plantMonitor/Keanu_Leaves/out/moisture -u cs326 -P piot 
"""



#TODO: handle sensor errors
#TODO: calibrate pump input
#TODO: implement utility channel, storing plant data in file, etc.
#TODO: make publishing frequency easily editable
#TODO: set up storing data for frequency duration then publishing averages
#TODO: calibrate temperature
# from mqtt-led.py:
from gpiozero import LED
import paho.mqtt.client as mqtt

# from lab4: temperature reader
import smbus

#from lab5: PWM
#from gpiozero import PWMOutputDevice
#from gpiozero import Servo

#
import pigpio
import os, time
import lgpio

# from lab4: A/D Conversion
from time import sleep
import busio
import digitalio
import board
import adafruit_mcp3xxx.mcp3008 as MCP
from adafruit_mcp3xxx.analog_in import AnalogIn


""" with open("plantVars.txt", "r") as file:
    lines = file.readlines() """

#   GPIO PINS:  
temperatureDatePin = 2
temperatureClockPin = 3
#microservoPin = 18  #hardware PWM



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
light1 = LED(23)
pi = pigpio.pi()   
# Connect to I2C bus
bus = smbus.SMBus(I2CBUS)
t1 = time.time_ns()

lightActuators = [light1]
pumps = [LED(16), LED(20), LED(21)]
lightChannels = [AnalogIn(mcp, MCP.P0)]
moistureChannels = [AnalogIn(mcp, MCP.P1), AnalogIn(mcp, MCP.P2), AnalogIn(mcp, MCP.P3), AnalogIn(mcp, MCP.P4)]
plantData = []

def readPlantDataIn():
    plantFile = open("plantFile.txt", "r")
    plantFileDump = plantFile.readlines()
    plantsLength = len(plantFileDump)
    """ [0]plant_name, [1]moistureChannel, [2]lightChannel, [3]pumpNumber, [4]lightActuatorNumber"""
    i = 0
    while i < plantsLength:
        line = plantFileDump[i]
        values = line.strip().split(" ")
        plantValues = []
        plantValues.append(values[0]) #name
        plantValues.append(moistureChannels[int(values[1])])
        plantValues.append(lightChannels[int(values[2])])
        plantValues.append(pumps[int(values[3])])
        plantValues.append(lightActuators[int(values[4])])
        plantData.append(plantValues)
        i += 1
    plantFile.close
    return

def plantDataAdd(messageString):
    plantFile = open("plantFile.txt", "a")
    string = messageString.split(' ')
    plantFile.write(f"{string[1]} {string[2]} {string[3]} {string[4]} {string[5]}\n")
    plantFile.close

def plantDataRemove(messageString):
    plantName = messageString.split(" ")[1]
    plantFile = open("plantFile.txt", "r")
    plantFileDump = plantFile.readlines()
    newFile = []
    i = 0
    while i < len(plantFileDump):
        if plantFileDump[i].split(" ")[0] != plantName:
            newFile.append(plantFileDump[i])
        i += 1
    plantFile.close
    plantFile = open("plantFile.txt", "w")
    plantFile.writelines(newFile)
    plantFile.close()
    

if not pi.connected:
    exit(0)
#pi.set_PWM_frequency(microservoPin,50);   #set PWM frequency to 50Hz

# Callback when client receives a message from the broker
def on_message(client, data, msg):
    try:
        message_topic = msg.topic.split('/')
        message = msg.payload.decode()
        if message_topic[2] == 'utility':
            if message.startswith("add"):
                plantDataAdd(message)
            elif message.startswith("remove"):
                plantDataRemove(message)
            readPlantDataIn()
            

        #SPLIT INTO SECTIONS
        elif message_topic[3] == 'in':
            plant_name = message_topic[2]
            i = 0
            plant_index = numPlants
            while i < numPlants:
                if plant_name == plantData[i][0]:
                    plant_index = i
                i += 1

            client.publish(TOPIC_OUT, 'seen')
            if message.startswith("pump_on_"):
                volume = float(message.split('_')[2])
                volume = int(volume)
                message = "pump_on"
            match message:
                case "turn_light_on":
                    plantData[plant_index][4].on()
                case "turn_light_off":
                    plantData[plant_index][4].off()
                case "pump_on":
                    pumpDuration = volume/0.1722 + 56.7526
                    plantData[plant_index][3].on()
                    time.sleep(0.01*pumpDuration)
                    plantData[plant_index][3].off()
                    i = 0
    except Exception as e:
        print("An error occurred:", e)

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

# TODO: add function to store time and check, determine when to read and publish values
readPlantDataIn()
numPlants = len(plantData)

try:
    while True:
        t2 = time.time_ns()
        latestTemp = 0
        moisture = 0
        if (t2 - t1) > DELAY:
            try:
                temperature = bus.read_byte(I2CADDRESS) - 9.5
                latestTemp = temperature
            except:
                temperature = latestTemp
            i = 0
            while i < numPlants:
                currentTopicStem = f"{TOPIC_STEM}{plantData[i][0]}/out"
                try:
                    moisture = (1024 - (plantData[i][1].value>>6))/1024 * 100
                except:
                    moisture = 100
                try:
                    lightvalue = plantData[i][2].value>>6
                except:
                    lightvalue = 0
                # client.publish(f"{currentTopicStem}", currentTopicStem)
                # client.publish(f"{currentTopicStem}/time", t2)
                client.publish(f"{currentTopicStem}/temperature", temperature)
                client.publish(f"{currentTopicStem}/light", lightvalue)
                client.publish(f"{currentTopicStem}/moisture", moisture)
                i += 1
            i = 0
            t1 = time.time_ns()
        client.loop()


except KeyboardInterrupt:
    client.disconnect()
    bus.close()
    print('Done')



