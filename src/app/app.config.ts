import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideFirebaseApp(() => initializeApp({"projectId":"houseplant-monitor-service","appId":"1:61251023349:web:dc57962c2325ff105a30bc","storageBucket":"houseplant-monitor-service.firebasestorage.app","apiKey":"AIzaSyAfIoN9rjVlHPs9bcbR-_lE6KJCaWrd2qE","authDomain":"houseplant-monitor-service.firebaseapp.com","messagingSenderId":"61251023349","measurementId":"G-L9K85C86J9"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())]
};
