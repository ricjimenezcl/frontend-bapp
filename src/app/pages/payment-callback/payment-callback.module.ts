import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { PaymentCallbackPage } from './payment-callback.page';

const routes: Routes = [
  {
    path: '',
    component: PaymentCallbackPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [PaymentCallbackPage]
})
export class PaymentCallbackPageModule {}
