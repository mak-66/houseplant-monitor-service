import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

import { MqttModule, IMqttServiceOptions } from 'ngx-mqtt';

export const MQTT_SERVICE_OPTIONS: IMqttServiceOptions = {
  hostname: 'iot.cs.calvin.edu', // Replace with your broker's hostname
  port: 8083, // Replace with the WebSocket port (e.g., 8083 for unencrypted WebSocket)
  path: '/', // Path for WebSocket connections
  protocol: 'ws', // Use 'wss' for secure WebSocket if required
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideFirebaseApp(() => 
      initializeApp({
        apiKey: "AIzaSyAfIoN9rjVlHPs9bcbR-_lE6KJCaWrd2qE",
        authDomain: "houseplant-monitor-service.firebaseapp.com",
        projectId: "houseplant-monitor-service",
        storageBucket: "houseplant-monitor-service.firebasestorage.app",
        messagingSenderId: "61251023349",
        appId: "1:61251023349:web:dc57962c2325ff105a30bc",
        measurementId: "G-L9K85C86J9",
      })),
    provideAuth(() => getAuth()), 
    provideFirestore(() => getFirestore())]
};
