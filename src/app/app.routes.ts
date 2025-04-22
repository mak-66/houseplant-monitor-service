import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { LoginComponent } from './components/login/login.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { SignupComponent } from './components/signup/signup.component';
import { DetailComponent } from './components/detail/detail.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'gallery', component: GalleryComponent, canActivate: [AuthGuard] },
    { path: 'detail/:plantID', component: DetailComponent, canActivate: [AuthGuard] },

    { path: '**', redirectTo: '' }
    
]; 
