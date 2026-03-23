import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { ProductCatalogPage } from './product-catalog.page';

const routes: Routes = [
  {
    path: '',
    component: ProductCatalogPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [ProductCatalogPage]
})
export class ProductCatalogPageModule {}
