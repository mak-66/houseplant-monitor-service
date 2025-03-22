import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { houseplantService } from './services/houseplant-service.service';  // Adjust the path to your service

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private houseplantService: houseplantService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const user = this.houseplantService.user; // This assumes your houseplantService holds user info

    if (user) {
      // If user is logged in, allow access
      return true;
    } else {
      // If not logged in, redirect to login page
      this.router.navigate(['/']);
      return false;
    }
  }
}
