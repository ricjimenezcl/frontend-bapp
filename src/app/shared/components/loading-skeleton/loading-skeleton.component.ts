import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './loading-skeleton.component.html',
  styleUrls: ['./loading-skeleton.component.scss'],
})
export class LoadingSkeletonComponent {
  @Input() type: 'provider-card' | 'category' | 'message' | 'list-item' = 'provider-card';
  @Input() count: number = 3;

  get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
