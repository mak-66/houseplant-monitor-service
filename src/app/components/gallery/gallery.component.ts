import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { houseplantService, Plant } from '../../services/houseplant-service.service';

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
  ownedPlants: Plant[] = [];

  async ngOnInit(): Promise<void> {
    this.ownedPlants = await this.houseplantService.fetchAccountPlants();
  }

  onPress(plantId: string): void {
    // sends to the first plant owned by the user
    this.router.navigate([`/detail/${plantId}`]);  // Navigate to the profile page
  }

  addPlant(): void {
    this.router.navigate(['/add-plant']);  // Navigate to the new plant page
  }

  async signOut(): Promise<void>{
    await this.houseplantService.logout();
  }
}