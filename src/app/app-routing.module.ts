import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home-module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then( m => m.AuthModule)
   },
  {
    path: 'provider',
    loadChildren: () => import('./provider/provider-module').then( m => m.ProviderModule)
  },
  {
    path: 'client',
    loadChildren: () => import('./client/client-module').then( m => m.ClientModule) 
  },
  {
    path: 'product-catalog',
    loadChildren: () => import('./pages/product-catalog/product-catalog.module').then(m => m.ProductCatalogPageModule)
  },
  {
    path: 'transactions',
    loadChildren: () => import('./pages/transactions/transactions.module').then(m => m.TransactionsPageModule)
  },
  {
    path: 'payment-callback',
    loadChildren: () => import('./pages/payment-callback/payment-callback.module').then(m => m.PaymentCallbackPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
