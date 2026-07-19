import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea, IonIcon,
  IonSpinner, IonText, IonNote,
  ModalController, ToastController
} from '@ionic/angular/standalone';
import { ReportService } from '../../../core/services/report.service';
import {
  ReportType,
  ReportedEntityType,
  ReportCreate,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_DESCRIPTIONS,
  REPORT_TYPE_ICONS
} from '../../../core/models/report.model';
import { ContentFilterService } from '../../../shared/services/content-filter.service';
import { firstValueFrom } from 'rxjs';

interface ReportTypeOption {
  value: ReportType;
  label: string;
  description: string;
  icon: string;
}

/**
 * Report Modal Component
 * Modal para reportar contenido inapropiado
 */
@Component({
  selector: 'app-report-modal',
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea, IonIcon,
    IonSpinner, IonText, IonNote
  ]
})
export class ReportModalComponent implements OnInit {
  @Input() entityType!: ReportedEntityType;
  @Input() entityId!: number;
  @Input() userId?: number;

  private readonly fb = inject(FormBuilder);
  private readonly reportService = inject(ReportService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly contentFilterService = inject(ContentFilterService);

  reportForm!: FormGroup;
  reportTypes: ReportTypeOption[] = [];
  selectedReportType: ReportType | null = null;
  isSubmitting = false;
  isCheckingContent = false;
  contentError = '';

  // Labels para UI
  readonly entityTypeLabels = {
    USER: 'usuario',
    REVIEW: 'reseña',
    SERVICE: 'servicio',
    CHAT_MESSAGE: 'mensaje'
  };

  ngOnInit() {
    this.initForm();
    this.loadReportTypes();
  }

  private initForm(): void {
    this.reportForm = this.fb.group({
      reportType: ['', Validators.required],
      description: ['', [Validators.maxLength(500)]]
    });

    // Escuchar cambios en el tipo de reporte
    this.reportForm.get('reportType')?.valueChanges.subscribe((type: ReportType) => {
      this.selectedReportType = type;
    });
  }

  private loadReportTypes(): void {
    this.reportTypes = (Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([value, label]) => ({
      value,
      label,
      description: REPORT_TYPE_DESCRIPTIONS[value],
      icon: REPORT_TYPE_ICONS[value]
    }));
  }

  /**
   * Obtener descripción del tipo de reporte seleccionado
   */
  getSelectedTypeDescription(): string {
    if (!this.selectedReportType) {
      return '';
    }
    return REPORT_TYPE_DESCRIPTIONS[this.selectedReportType];
  }

  /**
   * Enviar reporte
   */
  async submitReport() {
    if (!this.reportForm.valid || this.isSubmitting) {
      return;
    }

    const description = this.reportForm.value.description?.trim();
    if (description) {
      this.isCheckingContent = true;
      this.contentError = '';
      try {
        const result = await firstValueFrom(this.contentFilterService.validateText(description, 'generic'));
        if (result.blocked) {
          this.isCheckingContent = false;
          this.contentError = 'La descripción contiene lenguaje no permitido. Ajusta el texto para continuar.';
          return;
        }
      } catch {
        // UX fail-open: backend vuelve a validar al persistir.
      } finally {
        this.isCheckingContent = false;
      }
    } else {
      this.contentError = '';
    }

    this.isSubmitting = true;

    const report: ReportCreate = {
      report_type: this.reportForm.value.reportType,
      reported_entity_type: this.entityType,
      reported_entity_id: this.entityId,
      reported_user_id: this.userId,
      description: description || undefined
    };

    this.reportService.createReport(report).subscribe({
      next: async () => {
        await this.showToast(
          'Reporte enviado correctamente. Lo revisaremos pronto.',
          'success'
        );
        this.dismiss(true);
      },
      error: async (error) => {
        this.isSubmitting = false;
        console.error('Error al enviar reporte:', error);

        let message = 'Error al enviar el reporte. Intenta de nuevo.';
        
        if (error.status === 429) {
          message = 'Has reportado demasiado. Por favor, espera un momento.';
        } else if (error.status === 400) {
          message = error.error?.detail || 'Ya has reportado este contenido.';
        }

        await this.showToast(message, 'danger');
      }
    });
  }

  /**
   * Cerrar modal
   */
  dismiss(success = false) {
    this.modalCtrl.dismiss({ success });
  }

  /**
   * Mostrar toast
   */
  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  /**
   * Obtener nombre legible de la entidad
   */
  getEntityLabel(): string {
    return this.entityTypeLabels[this.entityType] || 'contenido';
  }
}
