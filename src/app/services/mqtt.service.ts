import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import mqtt from 'mqtt';

export interface MqttMessage {
  topic: string;
  payload: string;
}

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  private client!: mqtt.MqttClient;
  private messageSubject = new BehaviorSubject<MqttMessage | null>(null);
  public messages$ = this.messageSubject.asObservable();

  constructor() {
    this.connectToBroker();
  }

  private connectToBroker() {
    const brokerUrl = 'wss://iot.cs.calvin.edu:8083/mqtt'; // WebSocket URL for MQTT broker
    const options: mqtt.IClientOptions  = {
      username: 'cs326', // if authentication is required
      password: 'piot',  //A: set user and password
      protocol: 'mqtts', //A: set protocol to mqtts
    };

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    this.client.on('message', (topic, message) => {
      this.messageSubject.next({topic, payload: message.toString()});
    });

    this.client.on('error', (err) => {
      console.error('MQTT error:', err);
    });
  }

  subscribe(topic: string) {
    if (this.client.connected) {
      this.client.subscribe(topic, (err) => {
        if (!err) {
          console.log(`Subscribed to ${topic}`);
        }
      });
    }
  }

  publish(topic: string, message: string) {
    if (this.client.connected) {
      this.client.publish(topic, message, {qos: 2}); // QoS level 2 for exactly once delivery
      console.log(`Published message "${message}" to topic "${topic}"`);
    }
  }

  unsubscribe(topic: string) {
    if (this.client.connected) {
      this.client.unsubscribe(topic, () => {
        console.log(`Unsubscribed from ${topic}`);
      });
    }
  }

  disconnect() {
    if (this.client.connected) {
      this.client.end(() => {
        console.log('Disconnected from MQTT broker');
      });
    }
  }
}
