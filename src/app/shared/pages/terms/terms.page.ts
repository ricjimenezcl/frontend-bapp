import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.page.html',
  styleUrls: ['./terms.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class TermsPage {
  constructor(
    private readonly navCtrl: NavController,
    public readonly i18n: I18nService,
  ) {}

  close(): void {
    this.navCtrl.back();
  }
}
