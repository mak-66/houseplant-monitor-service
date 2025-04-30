import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const isLoggedIn = this.authService.isLoggedIn(); // Replace with your actual logic
    if (isLoggedIn) {
      return true;
    }

    // 👇 Return a UrlTree that redirects to the login route ('')
    return this.router.parseUrl('');
  }
}