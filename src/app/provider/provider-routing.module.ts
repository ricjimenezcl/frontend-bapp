import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'add-service',
    loadComponent: () => import('./pages/provider-add-service/provider-add-service.page').then(m => m.ProviderAddServicePage)
  },
  {
    path: 'provider-account-info',
    loadChildren: () => import('./pages/provider-account-info/provider-account-info.module').then(m => m.ProviderAccountInfoPageModule)
  },
  {
    path: 'provider-modal-service',
    loadChildren: () => import('./pages/provider-modal-service/provider-modal-service.module').then( m => m.ProviderModalServicePageModule)
  },
  {
    path: 'provider-edit-service',
    loadComponent: () => import('./pages/provider-edit-service/provider-edit-service.page').then( m => m.ProviderEditServicePage)
  }

  ,
  {
    path: 'provider-validation',
    loadComponent: () => import('./pages/provider-validation/provider-validation.component').then(m => m.ProviderValidationComponent)
  },  {
    path: 'provider-chats',
    loadChildren: () => import('./pages/provider-chats/provider-chats.module').then( m => m.ProviderChatsPageModule)
  }


];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProviderRoutingModule { }