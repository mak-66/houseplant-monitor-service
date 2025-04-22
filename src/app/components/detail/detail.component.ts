import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { houseplantService, Plant } from '../../services/houseplant-service.service';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.css'
})
export class DetailComponent {
  router = inject(Router);
  route = inject(ActivatedRoute);
  houseplantService = inject(houseplantService);
  plantID: string = '';
  plant: Plant | null = null; // Initialize plant to null

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.plantID = params['plantID'];
      // Load plant details using the ID
      this.loadPlantDetails();
    });
  }

  async loadPlantDetails() {
    try {
      // Implement this method in your service to get plant details
      this.plant = await this.houseplantService.fetchPlantByID(this.plantID);
    } catch (error) {
      console.error('Error loading plant details:', error);
    }
  }

  onSubmit(): void{
    // Handle form submission logic here
  }

  waterPlant() {
    console.log('Water button clicked');
    this.houseplantService.waterPlant(this.plantID).then(() => {
      console.log('Watering action sent!');
    })
  }

  lightPlantToggle() {
    console.log('Light button clicked');
    // Add your light logic here
  }

  back(): void{
    this.router.navigate(['/gallery']);
  }
}
