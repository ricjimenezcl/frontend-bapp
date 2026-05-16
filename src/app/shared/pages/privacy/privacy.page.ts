import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class PrivacyPage {
  constructor(private readonly navCtrl: NavController) {}

  close(): void {
    this.navCtrl.back();
  }
}
