import { Component, inject, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
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
  selectedImage?: File;
  newPlant: Partial<Plant> = {
    name: '',
    minimumMoisture: 0,
    waterVolume: 0,
    waterLog: [],
    minimumLight: 0,
    lightHours: 0,
    moistureLog: [],
    temperatureLog: [],
    lightLog: [],
    moistureChannelNum: 0,
    lightChannelNum: 0,
    pumpNum: 0,
    lightActuatorNum: 0
  };
  @ViewChild('plantForm') plantForm!: NgForm;


  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      this.selectedImage = file;
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.plantForm?.form.get(fieldName);
    return field ? (field.invalid && (field.dirty || field.touched)) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.plantForm?.form.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'This field is required';
      if (field.errors['min']) return 'Value must be greater than or equal to 0';
      if (field.errors['max']) {
        if (fieldName === 'minimumMoisture') return 'Value must be less than or equal to 100';
        if (fieldName === 'minimumLight') return 'Value must be less than or equal to 48';
        if (fieldName === 'lightHours') return 'Value must be less than or equal to 24';
      }
    }
    return '';
  }

  async onSubmit() {
    try {
      const plantId = await this.houseplantService.addPlant(this.newPlant, this.selectedImage);
      if (plantId !== "Failed to add plant") {
        console.log('Plant added successfully');
        // Send MQTT message to configure the new plant
        this.houseplantService.mqttService.publish(
          'cs326/plantMonitor/utility',
          `add ${this.newPlant.name} ${this.newPlant.moistureChannelNum} ${this.newPlant.lightChannelNum} ${this.newPlant.pumpNum} ${this.newPlant.lightActuatorNum}`
        );
        this.router.navigate(['/gallery']);
      }
    } catch (error) {
      console.error('Error adding plant:', error);
    }
  }

  back() {
    this.router.navigate(['/gallery']);
  }
}