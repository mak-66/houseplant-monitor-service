import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { formatDistanceToNow } from 'date-fns';
import { houseplantService } from '../../services/houseplant-service.service';
import { Plant } from '../../services/houseplant-service.service';
import { Timestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { interval, Subscription } from 'rxjs';

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

  // local variables for plant settings
  plantName: string = '';
  waterVolume: number = 0;
  moistureLevel: number = 0;
  minimumLight: number = 0;
  lightHours: number = 0;
  moistureChannelNum: number = 0;
  lightChannelNum: number = 0;
  pumpNum: number = 0;
  lightActuatorNum: number = 0;
  
  charts: Chart[] = [];
  isLightOn: boolean = false;
  updateSubscription: Subscription | null = null;


    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private houseplantService: houseplantService,
    ) {}

    ngOnInit() {
        this.route.params.subscribe(params => {
            this.plantId = params['plantId'];
            console.log('Plant ID from route:', this.plantId);
            this.loadPlantDetails();
            this.startAutoUpdate();
        });
    }

    async loadPlantDetails() {
    // fetches the plant's information using the plantId from the route
        try {
            const returnedPlant = await this.houseplantService.fetchPlantByID(this.plantId);
            if (returnedPlant) {
                this.plant = returnedPlant as Plant;
                this.plantName = this.plant.name;
                this.waterVolume = this.plant.waterVolume;
                this.moistureLevel = this.plant.minimumMoisture;
                this.minimumLight = this.plant.minimumLight;
                this.lightHours = this.plant.lightHours;
                this.moistureChannelNum = this.plant.moistureChannelNum;
                this.lightChannelNum = this.plant.lightChannelNum;
                this.pumpNum = this.plant.pumpNum;
                this.lightActuatorNum = this.plant.lightActuatorNum;
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

  ngAfterViewInit() {
    if (this.plant) {
    // only initialize charts if plant data is available
      this.initializeCharts();
    }
  }

  ngOnDestroy() {
    // clean up subscription when component is destroyed
    if (this.updateSubscription) {
        this.updateSubscription.unsubscribe();
    }
    // Clean up charts
    this.charts.forEach(chart => chart.destroy());
  }

  async updateSettings() {
    // synchonizes the local variables with the plant settings and updates the plant settings in the database
    try {
        const updates: Partial<Plant> = {
            name: this.plantName,
            minimumMoisture: this.moistureLevel,
            waterVolume: this.waterVolume,
            minimumLight: this.minimumLight,
            lightHours: this.lightHours,
            moistureChannelNum: this.moistureChannelNum,
            lightChannelNum: this.lightChannelNum,
            pumpNum: this.pumpNum,
            lightActuatorNum: this.lightActuatorNum
        };
        await this.houseplantService.updatePlant(this.plant!.id, updates);
        console.log('Plant settings updated successfully');
    } catch (error) {
        console.error('Error updating plant settings:', error);
    }
}

  private startAutoUpdate() {
    // Update every 30 seconds
    this.updateSubscription = interval(30000).subscribe(() => {
        this.loadPlantDetails();
    });
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

  getCurrentMoisture(): number {
    if (!this.plant?.moistureLog.length) return 0;
    return this.plant.moistureLog[this.plant.moistureLog.length - 1].number;
  }

  getLastWateringTime(): string {
    if (!this.plant?.waterLog.length) return 'Never';
    const lastWatering = this.plant.waterLog[this.plant.waterLog.length - 1];
    return formatDistanceToNow(lastWatering.toDate(), { addSuffix: true });
  }

  private getMoistureData(): number[] {
    if (!this.plant?.moistureLog) return [];
    
    // get the last 30 days of data based on timestamp
    const sortedLog = [...this.plant.moistureLog].sort((a, b) =>
        a.Timestamp.seconds - b.Timestamp.seconds
    ).filter(log => {
        const logDate = log.Timestamp.toDate();
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 3600 * 24));
        return diffInDays <= 30;
    });
    
    return sortedLog.map(log => Number(log.number.toFixed(2))); // Round to 2 decimal places
  }

  private getTemperatureData(): number[] {
    if (!this.plant?.temperatureLog) return [];
    // Sort by timestamp to ensure chronological order
    const sortedLog = [...this.plant.temperatureLog].sort((a, b) => 
        a.Timestamp.seconds - b.Timestamp.seconds
    );

    // get the last 30 days of data based on timestamp
    const lastMonth = sortedLog.filter(log => {
        const logDate = log.Timestamp.toDate();
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 3600 * 24));
        return diffInDays <= 30;
    });

    return lastMonth.map(log => log.number);
  }

  private getSunlightHours(): number[] {
    if (!this.plant?.lightLog) return [];
    
    // Group timestamps by day
    const dailyCounts = new Map<string, number>();
    
    this.plant.lightLog.forEach(timestamp => {
        const date = timestamp.toDate();
        const dateKey = date.toLocaleDateString();
        dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    });

    // Convert to array of counts in chronological order
    const sortedDates = Array.from(dailyCounts.keys()).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
    );

    // get the last 30 days of data
    const lastMonth = sortedDates.slice(-30);
    
    return lastMonth.map(date => dailyCounts.get(date) || 0);
  }

  private initializeCharts() {
    if (this.plant) {
        // Moisture Chart
        const sortedMoistureLog = [...this.plant.moistureLog].sort((a, b) => 
            a.Timestamp.seconds - b.Timestamp.seconds
        );

        this.charts.push(new Chart(this.moistureChart.nativeElement, {
            type: 'line',
            data: {
                labels: sortedMoistureLog.map(log => {
                    const date = log.Timestamp.toDate();
                    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                }),
                datasets: [{
                    label: 'Moisture Level (%)',
                    data: sortedMoistureLog.map(log => log.number),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        }));

        // Sunlight Chart
        const dailySunlight = this.getSunlightHours();
        const uniqueDates = Array.from(new Set(
            this.plant.lightLog.map(ts => ts.toDate().toLocaleDateString())
        )).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        this.charts.push(new Chart(this.sunlightChart.nativeElement, {
            type: 'bar',
            data: {
                labels: uniqueDates,
                datasets: [{
                    label: 'Light Events per Day',
                    data: dailySunlight,
                    backgroundColor: 'rgb(255, 205, 86)'
                }]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        }));

        // Temperature Chart
        const sortedTempLog = [...this.plant.temperatureLog].sort((a, b) => 
            a.Timestamp.seconds - b.Timestamp.seconds
        );

        this.charts.push(new Chart(this.temperatureChart.nativeElement, {
            type: 'line',
            data: {
                labels: sortedTempLog.map(log => {
                    const date = log.Timestamp.toDate();
                    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                }),
                datasets: [{
                    label: 'Temperature (°C)',
                    data: sortedTempLog.map(log => log.number),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        }));
    }
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
  
  back() {
    this.router.navigate(['/gallery']);
  }

  deletePlant() {
    if (this.plant) {
        this.houseplantService.deletePlant(this.plant.id).then(() => {
            console.log('Plant deleted successfully');
            this.router.navigate(['/gallery']);
        }).catch(error => {
            console.error('Error deleting plant:', error);
        });
    }
  }
}