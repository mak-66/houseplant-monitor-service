import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { LoginComponent } from './components/login/login.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { SignupComponent } from './components/signup/signup.component';
import { DetailComponent } from './components/detail/detail.component';
import { AddPlantComponent } from './components/add-plant/add-plant.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'gallery', component: GalleryComponent, canActivate: [AuthGuard] },
    { path: 'detail/:plantId', component: DetailComponent, canActivate: [AuthGuard] },
    { path: 'add-plant', component: AddPlantComponent, canActivate: [AuthGuard]  },
    { path: '**', redirectTo: '' }
    
]; 
