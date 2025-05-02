import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import mqtt from 'mqtt';
import {environment} from '../../../.environment.js';

export default interface MqttMessage {
  topic: string;
  payload: string;
}

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  // handles communication with the MQTT broker
  private client!: mqtt.MqttClient;
  private messageSubject = new BehaviorSubject<MqttMessage | null>(null);
  public messages$ = this.messageSubject.asObservable();

  constructor() {
    this.connectToBroker();
  }

  private connectToBroker() {
    const brokerUrl = environment.mqtt.brokerUrl;
    const options: mqtt.IClientOptions  = {
      username: environment.mqtt.username,
      password: environment.mqtt.password,
      protocol: 'mqtts',
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
