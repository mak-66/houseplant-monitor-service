import { initializeApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: "AIzaSyAfIoN9rjVlHPs9bcbR-_lE6KJCaWrd2qE",
  authDomain: "houseplant-monitor-service.firebaseapp.com",
  projectId: "houseplant-monitor-service",
  storageBucket: "houseplant-monitor-service.firebasestorage.app",
  messagingSenderId: "61251023349",
  appId: "1:61251023349:web:dc57962c2325ff105a30bc",
  measurementId: "G-L9K85C86J9",
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);