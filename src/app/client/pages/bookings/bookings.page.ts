// src/app/client/pages/bookings/bookings.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CoreService, Booking } from '../../../shared/services/core.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ChatService } from '../../../core/services/chat.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { NotificationType } from '../../../core/models/chat.model';
import { ReviewModalComponent } from '../../../shared/components/review-modal/review-modal.component';

@Component({
  selector: 'app-client-bookings',
  templateUrl: './bookings.page.html',
  styleUrls: ['./bookings.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ClientBookingsPage implements OnInit, OnDestroy {

  bookings: Booking[] = [];
  isLoading = true;
  selectedSegment = 'upcoming';
  chatOpeningBookingId: number | null = null;
  private wsSub?: Subscription;

  constructor(
    private router: Router,
    private coreService: CoreService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private chatService: ChatService,
    private wsService: WebSocketService,
    private modalCtrl: ModalController,
  ) {}

  ngOnInit() {
    console.log('📋 [ClientBookings] ngOnInit ejecutado');
    this.loadBookings();
    this.subscribeToBookingCompleted();
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  private subscribeToBookingCompleted() {
    this.wsSub = this.wsService.getNotifications$()
      .pipe(filter((n: any) => n.notificationType === NotificationType.BOOKING_COMPLETED))
      .subscribe(async (notification: any) => {
        const bookingId = notification.relatedEntityId as number;
        // Update local booking status
        const booking = this.bookings.find(b => b.id === bookingId);
        if (booking) booking.status = 'COMPLETED';
        // Prompt for review
        await this.showReviewPrompt(bookingId, booking?.provider_id);
      });
  }

  private async showReviewPrompt(bookingId: number, providerId?: number) {
    if (!providerId) return;
    const modal = await this.modalCtrl.create({
      component: ReviewModalComponent,
      componentProps: { bookingId, providerId },
      breakpoints: [0, 0.75],
      initialBreakpoint: 0.75,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.reviewed) {
      await this.showToast('¡Reseña enviada!');
    }
  }

  ionViewWillEnter() {
    console.log('📋 [ClientBookings] ionViewWillEnter ejecutado');
  }

  loadBookings() {
    const currentUser = this.authService.getCurrentUser();
    console.log('📋 [ClientBookings] loadBookings - currentUser:', currentUser);
    if (!currentUser) {
      console.warn('⚠️ [ClientBookings] No hay usuario autenticado, abortando carga');
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    const clientId = Number(currentUser.user_id || currentUser.id);
    console.log('📋 [ClientBookings] Solicitando bookings para client_id:', clientId);
    this.coreService.getClientBookings(clientId).subscribe({
      next: (response: any) => {
        console.log('✅ [ClientBookings] Response:', response);
        // El backend devuelve { items: [...], total: X, page: 1, size: Y }
        const bookingsArray = Array.isArray(response) ? response : (response?.items || response || []);
        this.bookings = bookingsArray;
        console.log('✅ [ClientBookings] Bookings cargados:', this.bookings.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ [ClientBookings] Error loading bookings:', error);
        this.isLoading = false;
      }
    });
  }

  get filteredBookings(): Booking[] {
    const now = new Date();

    return this.bookings.filter(booking => {
      const status = (booking.status || '').toUpperCase();

      if (this.selectedSegment === 'upcoming') {
        // Próximas: confirmadas o en progreso (futuras o sin fecha)
        if (status === 'CANCELLED') return false;
        if (status === 'PENDING') return false;
        if (!booking.scheduled_date) return status === 'CONFIRMED' || status === 'IN_PROGRESS';
        const bookingDate = new Date(booking.scheduled_date);
        return bookingDate >= now && (status === 'CONFIRMED' || status === 'IN_PROGRESS');
      } else if (this.selectedSegment === 'past') {
        // Pendientes + Completadas + pasadas
        if (status === 'CANCELLED') return false;
        if (status === 'PENDING') return true;
        if (status === 'COMPLETED') return true;
        if (!booking.scheduled_date) return false;
        const bookingDate = new Date(booking.scheduled_date);
        return bookingDate < now;
      } else {
        // Canceladas
        return status === 'CANCELLED';
      }
    });
  }

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
  }

  async cancelBooking(booking: Booking) {
    const alert = await this.alertCtrl.create({
      header: 'Cancelar Reserva',
      message: '¿Estás seguro de que deseas cancelar esta reserva?',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí, cancelar',
          handler: () => {
            if (booking.id) {
              this.coreService.cancelBooking(booking.id).subscribe({
                next: () => {
                  this.showToast('Reserva cancelada');
                  this.loadBookings();
                },
                error: () => {
                  this.showToast('Error al cancelar la reserva');
                }
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  getStatusColor(status: string | undefined): string {
    switch (status) {
      case 'CONFIRMED': return 'success';
      case 'PENDING': return 'warning';
      case 'COMPLETED': return 'primary';
      case 'CANCELLED': return 'danger';
      default: return 'medium';
    }
  }

  getStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'CONFIRMED': return 'Confirmada';
      case 'PENDING': return 'Pendiente';
      case 'COMPLETED': return 'Completada';
      case 'CANCELLED': return 'Cancelada';
      default: return 'Desconocido';
    }
  }

  doRefresh(event: any) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      event.target.complete();
      return;
    }
    
    this.coreService.getClientBookings(Number(currentUser.id)).subscribe({
      next: (response: any) => {
        // El backend devuelve { items: [...], total: X, page: 1, size: Y }
        const bookingsArray = Array.isArray(response) ? response : (response?.items || response || []);
        this.bookings = bookingsArray;
        event.target.complete();
      },
      error: () => {
        event.target.complete();
      }
    });
  }

  goToChat(booking: Booking) {
    if (!booking?.provider_id) {
      this.showToast('No encontramos un proveedor asociado a esta reserva.');
      return;
    }

    const providerId = Number(booking.provider_id);
    if (Number.isNaN(providerId)) {
      this.showToast('El identificador del proveedor es inválido.');
      return;
    }

    this.chatOpeningBookingId = booking.id ?? null;

    this.chatService.startConversationWithProvider(providerId).subscribe({
      next: (conversation) => {
        this.chatOpeningBookingId = null;
        this.router.navigate(['/chat', conversation.id], {
          state: { bookingId: booking.id }
        });
      },
      error: (error) => {
        console.error('Error al abrir el chat:', error);
        this.chatOpeningBookingId = null;
        this.showToast('No pudimos abrir el chat. Intenta nuevamente.');
      }
    });
  }
}
