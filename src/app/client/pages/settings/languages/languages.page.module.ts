import { LanguagesPage } from './languages.page';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [LanguagesPage],
  imports: [IonicModule, CommonModule, RouterModule.forChild([])],
})
export class LanguagesPageModule {}
