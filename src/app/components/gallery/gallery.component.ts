import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { houseplantService } from '../../services/houseplant-service.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent {
  houseplantService = inject(houseplantService);
  router = inject(Router);

  onPress(): void {
    this.router.navigate(['/detail']);  // Navigate to the profile page
  }

  async signOut(): Promise<void>{
    await this.houseplantService.logout();
  }
}