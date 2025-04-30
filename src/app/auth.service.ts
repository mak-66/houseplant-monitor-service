import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor() {}

  // Simulates login state stored in localStorage (can be adapted to Firebase or JWT)
  isLoggedIn(): boolean {
    // Check for an auth token or flag in localStorage
    return !!localStorage.getItem('userToken');
  }

  login(token: string): void {
    localStorage.setItem('userToken', token);
  }

  logout(): void {
    localStorage.removeItem('userToken');
  }
}
