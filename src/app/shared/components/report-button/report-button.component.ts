import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, ModalController } from '@ionic/angular/standalone';
import { ReportedEntityType } from '../../../core/models/report.model';
import { ReportModalComponent } from '../report-modal/report-modal.component';

/**
 * Report Button Component
 * Botón para abrir modal de reporte
 * Se usa en perfiles, reseñas, servicios, etc.
 */
@Component({
  selector: 'app-report-button',
  templateUrl: './report-button.component.html',
  styleUrls: ['./report-button.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon]
})
export class ReportButtonComponent {
  @Input() entityType!: ReportedEntityType;
  @Input() entityId!: number;
  @Input() userId?: number;
  @Input() buttonStyle: 'icon' | 'text' | 'full' = 'icon';
  @Input() color: string = 'danger';
  @Input() size: 'small' | 'default' | 'large' = 'default';

  private readonly modalCtrl = inject(ModalController);

  /**
   * Abrir modal de reporte
   */
  async openReportModal() {
    const modal = await this.modalCtrl.create({
      component: ReportModalComponent,
      componentProps: {
        entityType: this.entityType,
        entityId: this.entityId,
        userId: this.userId
      },
      cssClass: 'report-modal'
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.success) {
      console.log('Reporte enviado exitosamente');
    }
  }
}
