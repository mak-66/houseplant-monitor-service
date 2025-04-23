import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { houseplantService, Plant } from '../../services/houseplant-service.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-add-plant',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './add-plant.component.html',
  styleUrls: ['./add-plant.component.css']
})
export class AddPlantComponent {
  private router = inject(Router);
  private houseplantService = inject(houseplantService);

  newPlant: Partial<Plant> = {
    name: '',
    minimumMoisture: 0,
    waterVolume: 0,
    waterLog: [],
    moistureLog: [],
    temperatureLog: [],
    lightLog: [],
  };

  async onSubmit() {
    try {
      const plantId = await this.houseplantService.addPlant(this.newPlant);
      if (plantId !== "Failed to add plant") {
        console.log('Plant added successfully');
        this.router.navigate(['/gallery']);
      } else {
        console.error('Failed to add plant');
      }
    } catch (error) {
      console.error('Error adding plant:', error);
    }
  }

  back() {
    this.router.navigate(['/gallery']);
  }
}