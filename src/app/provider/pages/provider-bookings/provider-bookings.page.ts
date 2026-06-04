import { Component,  OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { ProviderBookingService } from '../../services/provider-booking.service';
import { BookingResponse, BookingStatus } from '../../../core/models/booking.model';
import { ClientService } from '../../../client/services/client.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-provider-bookings',
  templateUrl: './provider-bookings.page.html',
  styleUrls: ['./provider-bookings.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule]
})
export class ProviderBookingsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  bookings: BookingResponse[] = [];
  filteredBookings: BookingResponse[] = [];
  selectedSegment: string = 'pending';
  isLoading = true;

  constructor(
    private bookingService: ProviderBookingService,
    private clientService: ClientService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    // CSS-based tabs — ionViewWillEnter nunca se dispara en este contexto
    this.loadBookings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    this.loadBookings();
  }

  loadBookings() {
    this.isLoading = true;
    this.bookingService.getBookings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookings) => {
          this.bookings = bookings;
          this.filterBookings();
          this.isLoading = false;
          // Enriquecer con datos del cliente en background — no bloquea la vista
          this.enrichWithClientData(bookings);
        },
        error: (err: any) => {
          console.error('❌ [ProviderBookings] status:', err?.status, 'body:', err?.error);
          let errorMsg = 'Error cargando reservas';
          if (err?.status === 0) {
            errorMsg = 'Conectando al servidor...';
          } else if (err?.error?.detail) {
            errorMsg = err.error.detail;
          }
          this.showToast(errorMsg, 'danger');
          this.isLoading = false;
        }
      });
  }

  private enrichWithClientData(bookings: BookingResponse[]) {
    if (!bookings.length) return;
    const uniqueIds = [...new Set(bookings.map(b => b.client_id))];
    const clientRequests: { [key: string]: any } = {};
    uniqueIds.forEach(id => {
      clientRequests[id] = this.clientService.getClientById(Number(id)).pipe(catchError(() => of(null)));
    });

    forkJoin(clientRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe(clientMap => {
        this.bookings = this.bookings.map(b => ({
          ...b,
          client_name: (clientMap as any)[b.client_id]?.full_name ?? b.client_name,
          client_avatar: (clientMap as any)[b.client_id]?.avatar ?? b.client_avatar
        }));
        this.filterBookings();
      });
  }

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
    this.filterBookings();
  }

  filterBookings() {
    if (this.selectedSegment === 'pending') {
      this.filteredBookings = this.bookings.filter(b => {
        const s = (b.status || '').toUpperCase();
        return s === BookingStatus.PENDING;
      });
    } else if (this.selectedSegment === 'confirmed') {
      this.filteredBookings = this.bookings.filter(b => {
        const s = (b.status || '').toUpperCase();
        return s === BookingStatus.APPROVED || s === BookingStatus.CONFIRMED || s === BookingStatus.IN_PROGRESS;
      });
    } else {
      this.filteredBookings = this.bookings.filter(b => {
        const s = (b.status || '').toUpperCase();
        return s === BookingStatus.COMPLETED || s === BookingStatus.REJECTED ||
               s === BookingStatus.CANCELLED || s === BookingStatus.NOSHOW;
      });
    }
  }

  async acceptBooking(booking: BookingResponse) {
    const loading = await this.loadingCtrl.create({ message: 'Confirmando...' });
    await loading.present();

    this.bookingService.acceptBooking(Number(booking.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await loading.dismiss();
          this.showToast('Reserva confirmada exitosamente', 'success');
          this.loadBookings();
        },
        error: async (err) => {
          await loading.dismiss();
          console.error(err);
          this.showToast('Error al confirmar reserva', 'danger');
        }
      });
  }

  async rejectBooking(booking: BookingResponse) {
    const alert = await this.alertCtrl.create({
      header: 'Rechazar Reserva',
      message: '¿Estás seguro de que deseas rechazar esta solicitud?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Rechazando...' });
            await loading.present();

            this.bookingService.rejectBooking(Number(booking.id))
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: async () => {
                  await loading.dismiss();
                  this.showToast('Reserva rechazada', 'medium');
                  this.loadBookings();
                },
                error: async (err) => {
                  await loading.dismiss();
                  console.error(err);
                  this.showToast('Error al rechazar reserva', 'danger');
                }
              });
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
