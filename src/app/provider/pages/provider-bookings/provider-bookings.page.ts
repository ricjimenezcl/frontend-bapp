import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, switchMap, map, catchError } from 'rxjs/operators';
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
    // La carga inicial ocurre en ionViewWillEnter — evita doble HTTP
    // cuando ion-tabs dispara ngOnInit + ionViewWillEnter en la primera visita
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
    this.bookingService.getBookings().pipe(
      takeUntil(this.destroy$),
      switchMap(bookings => {
        if (!bookings.length) return of(bookings);
        const uniqueIds = [...new Set(bookings.map(b => b.client_id))];
        const clientRequests = uniqueIds.reduce((acc, id) => {
          acc[id] = this.clientService.getClientById(id).pipe(catchError(() => of(null)));
          return acc;
        }, {} as Record<number, any>);
        return forkJoin(clientRequests).pipe(
          map(clientMap => bookings.map(b => ({
            ...b,
            client_name: (clientMap as any)[b.client_id]?.full_name ?? undefined,
            client_avatar: (clientMap as any)[b.client_id]?.avatar ?? undefined
          })))
        );
      })
    ).subscribe({
      next: (res) => {
        this.bookings = res;
        this.filterBookings();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ [ProviderBookings] Error cargando bookings:', err);
        this.showToast('Error cargando reservas', 'danger');
        this.isLoading = false;
      }
    });
  }

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
    this.filterBookings();
  }

  filterBookings() {
    if (this.selectedSegment === 'pending') {
      this.filteredBookings = this.bookings.filter(b => b.status?.toLowerCase() === BookingStatus.PENDING);
    } else if (this.selectedSegment === 'confirmed') {
      this.filteredBookings = this.bookings.filter(b => {
        const s = b.status?.toLowerCase();
        return s === BookingStatus.CONFIRMED || s === BookingStatus.IN_PROGRESS;
      });
    } else {
      this.filteredBookings = this.bookings.filter(b => {
        const s = b.status?.toLowerCase();
        return s === BookingStatus.COMPLETED || s === BookingStatus.CANCELLED;
      });
    }
  }

  async acceptBooking(booking: BookingResponse) {
    const loading = await this.loadingCtrl.create({ message: 'Confirmando...' });
    await loading.present();

    this.bookingService.acceptBooking(booking.id)
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

            this.bookingService.rejectBooking(booking.id)
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
