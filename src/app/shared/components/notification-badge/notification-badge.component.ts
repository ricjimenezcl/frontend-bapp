import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { NotificationStateService } from '../../../core/services/notification-state.service';

@Component({
    selector: 'app-notification-badge',
    template: `
    <ion-button routerLink="/notifications">
      <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
      <ion-badge *ngIf="(unreadCount$ | async) as count" 
                 color="danger" 
                 class="notification-badge">
        {{ count > 99 ? '99+' : count }}
      </ion-badge>
    </ion-button>
  `,
    styles: [`
    .notification-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 0.7rem;
      padding: 3px 5px;
      border-radius: 10px;
    }
    ion-button {
      position: relative;
    }
  `],
    standalone: true,
    imports: [CommonModule, IonicModule, RouterModule]
})
export class NotificationBadgeComponent implements OnInit {

    unreadCount$: Observable<number>;

    constructor(private notificationState: NotificationStateService) {
        this.unreadCount$ = this.notificationState.unreadCount$;
    }

    ngOnInit() { }
}
