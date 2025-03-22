import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { LoginComponent } from './components/login/login.component';
import { GalleryComponent } from './components/gallery/gallery.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'gallery', component: GalleryComponent},

    { path: '**', redirectTo: '' }
    
]; 
