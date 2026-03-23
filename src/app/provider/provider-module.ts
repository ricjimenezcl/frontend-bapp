import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ProviderRoutingModule } from './provider-routing.module';
import { ProviderValidationComponent } from './pages/provider-validation/provider-validation.component';

@NgModule({
  declarations: [ProviderValidationComponent],
  imports: [
    CommonModule,
    IonicModule,
    ProviderRoutingModule
  ]
})
export class ProviderModule { }