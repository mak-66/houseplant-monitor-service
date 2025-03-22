import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent {
  router = inject(Router);

  async onPress(): Promise<void> {
    this.router.navigate(['/detail']);  // Navigate to the profile page
  }
}