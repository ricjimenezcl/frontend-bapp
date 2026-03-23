import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { PremiumBadgeComponent } from './premium-badge/premium-badge.component';
import { ServiceSlotsComponent } from './service-slots/service-slots.component';

@NgModule({
  declarations: [
    PremiumBadgeComponent,
    ServiceSlotsComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  exports: [
    PremiumBadgeComponent,
    ServiceSlotsComponent
  ]
})
export class MonetizationComponentsModule {}
