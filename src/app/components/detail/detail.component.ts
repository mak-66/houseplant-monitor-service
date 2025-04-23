import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { formatDistanceToNow } from 'date-fns';
import { houseplantService } from '../../services/houseplant-service.service';
import { Plant } from '../../services/houseplant-service.service';
import { Timestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule

Chart.register(...registerables);

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.css'],
  imports: [FormsModule], // Add FormsModule to imports
  standalone: true,
})
export class DetailComponent implements OnInit, AfterViewInit {
  @ViewChild('moistureChart') moistureChart!: ElementRef;
  @ViewChild('sunlightChart') sunlightChart!: ElementRef;
  @ViewChild('temperatureChart') temperatureChart!: ElementRef;

  plant: Plant | null = null;
  plantId: string = '';
  private charts: Chart[] = [];
  waterVolume: number = 0;
  moistureLevel: number = 0;
  isLightOn: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private houseplantService: houseplantService
  ) {}

  async loadPlantDetails() {
    try {
        if (!this.plantId) {
            console.error('No plant ID provided');
            return;
        }
        const returnedPlant = await this.houseplantService.fetchPlantByID(this.plantId);
        if (returnedPlant) {
            this.plant = returnedPlant as Plant;
            // Initialize form values with current plant settings
            this.waterVolume = this.plant.waterVolume;
            this.moistureLevel = this.plant.minimumMoisture;
        } else {
            console.error('Plant not found');
            this.router.navigate(['/gallery']);
            return;
        }

        if (this.charts.length > 0) {
            this.updateCharts();
        } else {
            this.initializeCharts();
        }
    } catch (error) {
        console.error('Error loading plant details:', error);
        this.router.navigate(['/gallery']);
    }
}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.plantId = params['plantId']; // Note: case sensitive!
      console.log('Plant ID from route:', this.plantId);
      this.loadPlantDetails();
    });
  }

  ngAfterViewInit() {
    if (this.plant) {
      this.initializeCharts();
    }
  }

  async updateSettings() {
    try {
        const updates: Partial<Plant> = {waterVolume: this.waterVolume, minimumMoisture: this.moistureLevel};
        await this.houseplantService.updatePlant(this.plant!.id, updates);
        console.log('Plant settings updated successfully');
    } catch (error) {
        console.error('Error updating plant settings:', error);
    }
  }

  private updateCharts() {
    this.charts.forEach(chart => {
      if (chart.canvas.id === 'moistureChart') {
        chart.data.datasets[0].data = this.getMoistureData();
        chart.update();
      } else if (chart.canvas.id === 'sunlightChart') {
        chart.data.datasets[0].data = this.getSunlightHours();
        chart.update();
      } else if (chart.canvas.id === 'temperatureChart') {
        chart.data.datasets[0].data = this.getTemperatureData();
        chart.update();
      }
    });
  }

  private initializeCharts() {
    if (this.plant) {
      // Moisture Chart
      this.charts.push(new Chart(this.moistureChart.nativeElement, {
        type: 'line',
        data: {
          labels: this.getLast30Days(),
          datasets: [{
            label: 'Moisture Level (%)',
            data: this.getMoistureData(),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }]
        }
      }));

      // Sunlight Chart
      this.charts.push(new Chart(this.sunlightChart.nativeElement, {
        type: 'bar',
        data: {
          labels: this.getLast7Days(),
          datasets: [{
            label: 'Hours of Sunlight',
            data: this.getSunlightHours(),
            backgroundColor: 'rgb(255, 205, 86)'
          }]
        }
      }));

      // Temperature Chart
      this.charts.push(new Chart(this.temperatureChart.nativeElement, {
        type: 'line',
        data: {
          labels: this.getLast24Hours(),
          datasets: [{
            label: 'Temperature (°C)',
            data: this.getTemperatureData(),
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          }]
        }
      }));
    }
  }

  getCurrentMoisture(): number {
    if (!this.plant?.moistureLog.length) return 0;
    return this.plant.moistureLog[this.plant.moistureLog.length - 1].number;
  }

  getLastWateringTime(): string {
    if (!this.plant?.waterLog.length) return 'Never';
    const lastWatering = this.plant.waterLog[this.plant.waterLog.length - 1];
    return formatDistanceToNow(lastWatering.toDate(), { addSuffix: true });
  }

  private getLast30Days(): string[] {
    return Array.from({length: 30}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString();
    }).reverse();
  }

  private getLast7Days(): string[] {
    return Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toLocaleDateString();
    }).reverse();
  }

  private getLast24Hours(): string[] {
    return Array.from({length: 24}, (_, i) => {
      const date = new Date();
      date.setHours(date.getHours() - i);
      return date.toLocaleTimeString();
    }).reverse();
  }

  private getMoistureData(): number[] {
    if (!this.plant?.moistureLog) return [];
    return this.plant.moistureLog.map(log => log.number);
  }

  private getSunlightHours(): number[] {
    if (!this.plant?.lightLog) return [];
    // Convert timestamps to daily hours
    // This is a simplified version - you'll need to implement the actual logic
    return [12, 10, 8, 13, 14, 12, 10];
  }

  private getTemperatureData(): number[] {
    if (!this.plant?.temperatureLog) return [];
    return this.plant.temperatureLog.map(log => log.number);
  }

  waterPlant() {
    if (this.plant) {
        this.houseplantService.waterPlant(this.plant.id);
    }
  }

  toggleLight() {
      if (this.plant) {
          this.isLightOn = !this.isLightOn;
          // Publish MQTT message to toggle light
          this.houseplantService.mqttService.publish(
              `cs326/plantMonitor/${this.plant.name}/in`,
              this.isLightOn ? 'turn_light_on' : 'turn_light_off'
          );
      }
  }
}