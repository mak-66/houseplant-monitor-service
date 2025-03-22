import { Component, computed, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { RouterLink, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { houseplantService, Plant } from '../../services/houseplant-service.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [MatToolbarModule, MatIconModule, MatCardModule, MatFormFieldModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  houseplantService = inject(houseplantService);
  router = inject(Router);
  password: string = '';
  email: string = '';

  async onSignUp(): Promise<void> {
    try {
      // Create an account object
      const newAccount = {
        ownedPlants: [],
        email: this.email,
      };

      // Call the createAccount method from houseplantService
      await this.houseplantService.createUser(this.email, this.password, newAccount);

      console.log('Account successfully created!');
      // Redirect to login page or profile page
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error during signup:', error);
    }
  }
}
