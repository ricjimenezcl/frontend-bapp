import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
})
export class EmptyStateComponent {
  @Input() icon: string = 'search-outline';
  @Input() title: string = 'Sin resultados';
  @Input() subtitle: string = '';
  @Input() actionLabel: string = '';
  @Input() compact: boolean = false;

  @Output() actionClick = new EventEmitter<void>();
}
