import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '', // Ruta base: /auth
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'set-new-password',
    loadComponent: () => import('./pages/set-new-password/set-new-password.page').then(m => m.SetNewPasswordPage)
  },
  {
    path: 'register',
    children: [
      {
        path: 'client',
        loadComponent: () => import('./pages/register-client/register-client.page').then(m => m.RegisterClientPage)
      },
      {
        path: 'provider',
        loadComponent: () => import('./pages/register-provider/register-provider.page').then(m => m.RegisterProviderPage)
      },
      {
        path: '', // /auth/register
        redirectTo: 'client',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }