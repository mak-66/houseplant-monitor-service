import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { houseplantService } from '../../services/houseplant-service.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  houseplantService = inject(houseplantService);
  router = inject(Router);
  email: string = ''; // Variable for username
  password: string = ''; // Variable for password
  loggedIn: boolean = true;

  // Method to handle login
  async onLogin(): Promise<void> {
    this.router.navigate(['/gallery']);
    try {
      // Call the login method of toolshedService with email and password
      this.loggedIn = await this.houseplantService.login(this.email, this.password);
      console.log('Login successful');
      //redirect to a different page after successful login
      if(this.loggedIn){
        this.router.navigate(['/gallery']);  // Navigate to the profile page
      }
    } catch (error) {
      console.error('Login failed:', error);
      // Optionally, display an error message to the user
    }
  }
  async signup(): Promise<void>{
    this.router.navigate(['/signup']);
  }
}

