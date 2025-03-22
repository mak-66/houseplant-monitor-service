import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Import FormsModule

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  router = inject(Router);
  email: string = ''; // Variable for username
  password: string = ''; // Variable for password

  async onLogin(): Promise<void> {

    this.router.navigate(['/gallery']);  // Navigate to the profile page
  }
}

