import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import mqtt from 'mqtt';

@Injectable({
  providedIn: 'root'
})
export class MqttService {
  private client!: mqtt.MqttClient;
  private messageSubject = new BehaviorSubject<string | null>(null);
  public messages$ = this.messageSubject.asObservable();

  constructor() {
    this.connectToBroker();
  }

  private connectToBroker() {
    const brokerUrl = 'wss://iot.cs.calvin.edu:1883'; // Use WebSockets for browser compatibility   A: set broker url to iot.cs.calvin.edu
    const options = {
      clientId: 'angular-client-' + Math.random().toString(16).substr(2, 8),
      username: 'cs326', // if authentication is required
      password: 'piot'  //A: set user and password
    };

    this.client = mqtt.connect(brokerUrl, options);

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    this.client.on('message', (topic, message) => {
      console.log(`Received message on topic ${topic}: ${message.toString()}`);
      this.messageSubject.next(message.toString());
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
      this.client.publish(topic, message);
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
