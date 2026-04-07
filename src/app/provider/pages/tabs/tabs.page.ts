import { Component, ViewEncapsulation } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-provider-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [IonicModule]
})
export class ProviderTabsPage {}
