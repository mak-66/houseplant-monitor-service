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
    // sends to the first plant owned by the user
    this.router.navigate([`/detail/${this.houseplantService.ownedPlantsData[0].id}`]);  // Navigate to the profile page
  }

  addPlant(): void {
    this.router.navigate(['/add-plant']);  // Navigate to the new plant page
  }

  async signOut(): Promise<void>{
    await this.houseplantService.logout();
  }
}