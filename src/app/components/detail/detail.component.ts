import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { houseplantService } from '../../services/houseplant-service.service';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.css'
})
export class DetailComponent {
  router = inject(Router);
  onSubmit(): void{
    // Handle form submission logic here
  }
  back(): void{
    this.router.navigate(['/gallery']);
  }
}
