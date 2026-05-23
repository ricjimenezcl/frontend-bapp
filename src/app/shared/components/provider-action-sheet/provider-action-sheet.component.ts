import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ModalController, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { Subject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil } from 'rxjs/operators';

import { CoreService, Review, WorkingHours, ServiceSchedule } from '../../services/core.service';
import { ClientBookingService } from '../../../client/services/client-booking.service';
import { BookingCreate } from '../../../core/models/booking.model';
import { ChatService } from '../../../core/services/chat.service';
import { AuthService } from '../../../auth/services/auth.service';
import { MapboxService } from '../../services/mapbox.service';
import { StateService } from '../../services/state.service';
import { ProviderImagePipe } from '../../pipes/provider-image.pipe';

interface CalendarDay {
  dateStr: string;      // YYYY-MM-DD
  dayLabel: string;     // "lun.", "mar.", …
  dayNum: number;       // 1-31
  monthLabel: string;   // "mar.", "abr.", …
  isActive: boolean;    // el proveedor trabaja ese día
  isSelected: boolean;  // día actualmente seleccionado
}

@Component({
  selector: 'app-provider-action-sheet',
  templateUrl: './provider-action-sheet.component.html',
  styleUrls: ['./provider-action-sheet.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, ProviderImagePipe]
})
export class ProviderActionSheetComponent implements OnInit {
  @Input() provider!: any;
  @Input() serviceId?: number;

  

  reviews: Review[] = [];
  isLoadingReviews = false;

  // ══ PORTAFOLIO Y SERVICIOS ══════════════════════════════════════════
  portfolioImages: { url: string; serviceName: string }[] = [];
  isLoadingPortfolio = false;
  providerServices: any[] = [];
  isLoadingServices = false;

  // ═════════════════════════════════════════════════════════════════════

  // Booking state
  showBookingModal = false;
  selectedDate = '';
  selectedTime = '';
  locationAddress = '';
  selectedAddressText = '';
  selectedAddressObject: any = null;
  description = '';
  bookingAttempted = false;
  /** Slots con disponibilidad real — time + available flag */
  allSlots: { time: string; available: boolean }[] = [];
  isLoadingTimes = false;
  providerWorkingHours: WorkingHours[] = [];
  hoursLoaded = false;
  /** Días del calendario (próximos 30 días) generados desde working hours */
  calendarDays: CalendarDay[] = [];
  /** Set de day_of_week (backend 0=Lun…6=Dom) activos — O(1) lookup */
  private activeDays = new Set<number>();
  /** Cache de slots por fecha YYYY-MM-DD — evita llamadas repetidas al backend */
  private slotsCache = new Map<string, { time: string; available: boolean }[]>();

  /** True si el proveedor tiene al menos un día activo configurado */
  get hasWorkingHours(): boolean { return this.activeDays.size > 0; }
  addressSuggestions: any[] = [];
  showAddressSuggestions = false;
  isSearching = false;
  isStartingChat = false;
  isConfirmingBooking = false;
  providerEmail = '';
  activeDetailTab: string = 'profile';
  userLocation: { lat: number; lng: number } | null = null;

  private hasShownLocationPrompt = false;
  private useManualAddress = false;
  private readonly searchTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  get isBookingValid(): boolean {
    return !!this.selectedDate && !!this.selectedTime && !!this.locationAddress;
  }

  // Campos normalizados del proveedor (cubre distintos nombres de campo)
  get providerName(): string {
    console.log("INFO PROVIDER : ", this.provider);
    return this.provider?.business_name || this.provider?.full_name || '';
  }

  get providerRating(): string | number {
    return this.provider?.rating_avg ?? this.provider?.rating ?? 'Nuevo';
  }

  get providerReviewCount(): number {
    return this.provider?.total_reviews ?? this.provider?.review_count ?? 0;
  }

  get providerAvatar(): string {
    return this.provider?.avatar ?? '';
  }

  get providerDistance(): number | null {
    return this.provider?.distance ?? null;
  }

  get providerHourlyRate(): number | null {
    return this.provider?.hourly_rate ?? null;
  }

  get providerDescription(): string {
    return this.provider?.description ?? this.provider?.bio ?? '';
  }

   get providerPhone(): string {
    return this.provider?.phone ?? 'No disponible';
  }

  get providerMail(): string {
    return this.providerEmail || this.provider?.email || '';
  }

  get providerAddress(): string {
    return this.provider?.address ?? 'No disponible';
  }

  constructor(
    private modalCtrl: ModalController,
    private router: Router,
    private coreService: CoreService,
    private clientBookingService: ClientBookingService,
    private chatService: ChatService,
    private authService: AuthService,
    private mapboxService: MapboxService,
    private stateService: StateService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.selectedDate = '';
    this.allSlots = [];

    const savedLoc = this.stateService.getUserLocation();
    if (savedLoc) {
      this.userLocation = { lat: savedLoc.latitude, lng: savedLoc.longitude };
    }

    this.loadProviderEmail();
    this.loadProviderWorkingHours();
    this.setupAutocomplete();
    this.loadReviews();
    
    // ══ CARGAR PORTAFOLIO Y SERVICIOS ══
    this.loadProviderPortfolioAndServices();
  }

  private loadProviderEmail() {
    const providerId = Number(this.provider?.provider_id ?? this.provider?.id ?? 0);
    if (!providerId) return;

    this.coreService.getProviderById(providerId).pipe(
      catchError(() => of(null))
    ).subscribe(data => {
      if (data) {
        const pd: any = data;
        this.providerEmail = pd.email || '';
      }
    });
  }

  private loadProviderWorkingHours() {
    const pid  = Number(this.provider?.provider_id  ?? this.provider?.id ?? 0);
    const spid = Number(this.provider?.service_provider_id ?? this.provider?.id ?? 0);
    if (!pid) return;

    // Ambas fuentes en paralelo — elimina la espera secuencial
    const wh$ = this.coreService.getProviderWorkingHours(pid).pipe(catchError(() => of([])));
    const ss$ = spid
      ? this.coreService.getServiceSchedules(pid, spid).pipe(catchError(() => of([])))
      : of([]);

    forkJoin([wh$, ss$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([hours, schedules]) => {
        this.providerWorkingHours = (hours as WorkingHours[]) || [];
        this.activeDays.clear();

        // Fuente primaria: ProviderWorkingHours
        this.providerWorkingHours
          .filter(h => !!h.is_active)
          .forEach(h => this.activeDays.add(h.day_of_week));

        // Fuente secundaria: ServiceAvailability (solo si ProviderWorkingHours está vacío)
        if (this.activeDays.size === 0) {
          (schedules as ServiceSchedule[])
            .filter(s => s.is_available)
            .forEach(s => {
              this.activeDays.add(s.day_of_week);
              this.providerWorkingHours.push({
                id: 0,
                provider_id: pid,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                is_active: true
              } as WorkingHours);
            });
        }

        this.hoursLoaded = true;
        this.generateCalendarDays();
      });
  }

  private loadReviews() {
    // provider_id es providers.id; id es service_providers.id
    const providerId = this.provider?.provider_id ?? this.provider?.id;
    if (!providerId) return;

    this.isLoadingReviews = true;
    this.coreService.getProviderReviews(providerId).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (reviews) => {
        this.reviews = reviews as Review[];
        this.isLoadingReviews = false;
      },
      error: () => {
        this.isLoadingReviews = false;
      }
    });
  }

  /**
   * Carga portafolio y servicios del proveedor
   * Extrae imágenes de portfolio_images de cada servicio y crea array flat
   */
  private loadProviderPortfolioAndServices() {
    const providerId = this.provider?.provider_id ?? this.provider?.id;
    if (!providerId) return;

    this.isLoadingPortfolio = true;
    this.isLoadingServices = true;

    this.coreService.getProviderServices(providerId).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (services: any[]) => {
        this.providerServices = services;
        this.isLoadingServices = false;

        // Extraer portfolio_images de todos los servicios
        this.portfolioImages = [];
        services.forEach((svc: any) => {
          if (svc.portfolio_images && Array.isArray(svc.portfolio_images)) {
            svc.portfolio_images.forEach((img: any) => {
              this.portfolioImages.push({
                url: img.url || img,
                serviceName: svc.business_name || svc.service_name || 'Servicio'
              });
            });
          }
        });

        this.isLoadingPortfolio = false;
      },
      error: () => {
        this.isLoadingPortfolio = false;
        this.isLoadingServices = false;
      }
    });
  }

  private setupAutocomplete() {
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) {
          this.addressSuggestions = [];
          this.showAddressSuggestions = false;
          return of([]);
        }
        this.isSearching = true;
        return this.mapboxService.autocompleteChile(term).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe({
      next: (suggestions: any[]) => {
        this.addressSuggestions = suggestions;
        this.showAddressSuggestions = suggestions.length > 0;
        this.isSearching = false;
      },
      error: () => {
        this.addressSuggestions = [];
        this.showAddressSuggestions = false;
        this.isSearching = false;
      }
    });
  }

  openBookingModal() {
    this.showBookingModal = true;
    if (!this.hoursLoaded) {
      this.loadProviderWorkingHours(); // generateCalendarDays se llama al final del subscribe
    } else {
      this.generateCalendarDays(); // regenera y auto-selecciona primer día disponible
    }
  }

  closeBookingModal() {
    this.showBookingModal = false;
    this.bookingAttempted = false;
    this.allSlots = [];
    this.selectedTime = '';
    this.slotsCache.clear();
  }

  /** Genera los próximos 30 días habilitando solo los días activos del proveedor */
  private generateCalendarDays(): void {
    const today = new Date();
    const days: CalendarDay[] = [];

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const y  = d.getFullYear();
      const mo = d.getMonth();
      const day = d.getDate();
      const dateStr = `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const backendDow = (d.getDay() + 6) % 7; // JS 0=Dom → backend 6; JS 1=Lun → backend 0
      days.push({
        dateStr,
        dayLabel:   d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayNum:     day,
        monthLabel: d.toLocaleDateString('es-ES', { month: 'short' }),
        isActive:   this.activeDays.has(backendDow),
        isSelected: false
      });
    }

    this.calendarDays = days;

    // Auto-seleccionar el primer día disponible y cargar sus slots
    const first = this.calendarDays.find(d => d.isActive);
    if (first) {
      first.isSelected  = true;
      this.selectedDate = first.dateStr;
      this.selectedTime = '';
      this.allSlots     = [];
      if (this.showBookingModal) {
        this.fetchAvailableSlots();
      }
    }
  }

  /** Selecciona un día del calendario y carga sus slots disponibles */
  selectCalendarDay(day: CalendarDay): void {
    if (!day.isActive) return;
    this.calendarDays.forEach(d => d.isSelected = false);
    day.isSelected    = true;
    this.selectedDate = day.dateStr;
    this.selectedTime = '';
    this.allSlots     = [];
    this.slotsCache.delete(day.dateStr); // invalidar cache para el nuevo día si lo había
    this.fetchAvailableSlots();
  }

  /** trackBy para el *ngFor del calendario — evita re-renders innecesarios */
  trackByDate(_index: number, day: CalendarDay): string {
    return day.dateStr;
  }

  /**
   * Muestra slots instantáneamente desde datos locales (working hours),
   * luego enriquece en background con el estado real de reservas del backend.
   */
  private fetchAvailableSlots(): void {
    if (!this.selectedDate) return;

    const datePart = this.selectedDate.substring(0, 10);

    // Bloquear si el proveedor no trabaja ese día — O(1) con activeDays
    if (this.hoursLoaded && this.activeDays.size > 0) {
      const [fy, fm, fd] = datePart.split('-').map(Number);
      const backendDow = (new Date(fy, fm - 1, fd).getDay() + 6) % 7;
      if (!this.activeDays.has(backendDow)) {
        this.allSlots = [];
        return;
      }
    }

    // Cache hit — respuesta inmediata sin llamada al backend
    const cached = this.slotsCache.get(datePart);
    if (cached) {
      this.allSlots = cached;
      return;
    }

    // Mostrar slots al instante desde datos locales (todos available por defecto)
    this.generateSlotsFromWorkingHours();
    if (this.allSlots.length > 0) {
      this.slotsCache.set(datePart, [...this.allSlots]); // cache provisional
    }

    // Enriquecer en background con estado real de reservas
    const pid  = Number(this.provider?.provider_id  ?? this.provider?.id ?? 0);
    const spid = Number(this.provider?.service_provider_id ?? this.provider?.id ?? 0);
    if (!pid || !spid) return;

    this.isLoadingTimes = true;
    this.coreService.getAvailableSlots(pid, spid, datePart)
      .pipe(takeUntil(this.destroy$), catchError(() => of(null)))
      .subscribe(response => {
        // Solo actualizar si el usuario sigue en la misma fecha
        if (this.selectedDate.startsWith(datePart) && response?.slots?.length) {
          this.allSlots = response.slots;
          this.slotsCache.set(datePart, response.slots);
        }
        this.isLoadingTimes = false;
      });
  }

  /** Genera slots de 60 min desde los working hours del proveedor (fallback) */
  private generateSlotsFromWorkingHours(): void {
    if (!this.selectedDate || this.providerWorkingHours.length === 0) {
      this.allSlots = [];
      return;
    }
    const [gy, gm, gd] = this.selectedDate.substring(0, 10).split('-').map(Number);
    const backendDow = (new Date(gy, gm - 1, gd).getDay() + 6) % 7;
    const dayHours = this.providerWorkingHours.find(h => h.day_of_week === backendDow && !!h.is_active && this.activeDays.has(h.day_of_week));
    if (!dayHours) {
      this.allSlots = [];
      return;
    }
    const [sh, sm] = dayHours.start_time.split(':').map(Number);
    const [eh, em] = dayHours.end_time.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;
    const slots: { time: string; available: boolean }[] = [];
    for (let m = startMins; m < endMins; m += 60) {
      slots.push({
        time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
        available: true  // sin info de reservas → todos disponibles
      });
    }
    this.allSlots = slots;
  }

  async onAddressFocus() {
    if (!this.hasShownLocationPrompt) {
      this.hasShownLocationPrompt = true;
      await this.askForLocationUsage();
      return;
    }
    if (this.useManualAddress && this.addressSuggestions.length > 0) {
      this.showAddressSuggestions = true;
    }
  }

  onAddressInput(event: any) {
    if (!this.useManualAddress) return;
    const query = event.target.value;
    this.selectedAddressText = query;
    this.locationAddress = query;
    if (this.selectedAddressObject && query !== this.getSuggestionDisplayText(this.selectedAddressObject)) {
      this.selectedAddressObject = null;
    }
    if (query.length >= 3) {
      this.isSearching = true;
      this.showAddressSuggestions = true;
      this.searchTerms.next(query);
    } else {
      this.showAddressSuggestions = false;
      this.addressSuggestions = [];
    }
  }

  onAddressBlur() {
    if (!this.useManualAddress) return;
    setTimeout(() => {
      if (this.selectedAddressObject && !this.selectedAddressText) {
        this.selectedAddressText = this.getSuggestionDisplayText(this.selectedAddressObject);
        this.locationAddress = this.selectedAddressText;
      }
      this.showAddressSuggestions = false;
    }, 200);
  }

  private async askForLocationUsage() {
    const alert = await this.alertCtrl.create({
      header: 'Ubicación del servicio',
      message: '¿Deseas usar tu ubicación actual o agregar una dirección?',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Usar ubicación actual',
          handler: () => {
            this.useManualAddress = false;
            this.useCurrentLocation();
          }
        },
        {
          text: 'Agregar dirección',
          handler: () => {
            this.useManualAddress = true;
            this.locationAddress = '';
            this.selectedAddressText = '';
          }
        }
      ]
    });
    await alert.present();
  }

  private useCurrentLocation() {
    if (!this.userLocation) return;
    this.locationAddress = 'Mi ubicación actual';
    this.selectedAddressText = 'Mi ubicación actual';
    this.selectedAddressObject = {
      center: [this.userLocation.lng, this.userLocation.lat],
      place_name: 'Mi ubicación actual'
    };
  }

  selectAddressSuggestion(suggestion: any) {
    this.selectedAddressObject = suggestion;
    this.selectedAddressText = this.getSuggestionDisplayText(suggestion);
    this.locationAddress = this.selectedAddressText;
    if (suggestion.center) {
      const [lng, lat] = suggestion.center;
      this.userLocation = { lat, lng };
    }
    this.showAddressSuggestions = false;
    this.addressSuggestions = [];
  }

  clearAddress() {
    this.selectedAddressText = '';
    this.locationAddress = '';
    this.selectedAddressObject = null;
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    this.useManualAddress = false;
    this.hasShownLocationPrompt = false;
  }

  getSuggestionDisplayText(suggestion: any): string {
    if (suggestion.text && suggestion.address) return `${suggestion.text} ${suggestion.address}`;
    if (suggestion.place_name) return suggestion.place_name;
    if (suggestion.text) return suggestion.text;
    return 'Dirección desconocida';
  }

  getSuggestionIcon(suggestion: any): string {
    const types = suggestion.place_type || [];
    if (types.includes('place')) return 'business';
    if (types.includes('address')) return 'home';
    if (types.includes('poi')) return 'flag';
    return 'location';
  }

  getSuggestionContext(suggestion: any): string {
    if (suggestion.place_name && suggestion.text) {
      const parts = suggestion.place_name.split(',');
      if (parts.length > 1) return parts.slice(1).join(',').trim();
    }
    return '';
  }

  async confirmBooking() {
    this.bookingAttempted = true;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.showToast('Debes iniciar sesión para reservar', 'warning');
      return;
    }

    if (!this.selectedDate || !this.selectedTime || !this.locationAddress) {
      this.showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    this.isConfirmingBooking = true;

    try {
      const datePart = this.selectedDate.includes('T') ? this.selectedDate.split('T')[0] : this.selectedDate;
      let timePart = this.selectedTime;
      if (timePart.length === 5) timePart = `${timePart}:00`;

      const prov = this.provider;
      const resolvedProviderId = Number(prov?.provider_id ?? prov?.id ?? 0);
      const resolvedServiceId = this.serviceId
        ?? Number(prov?.service_id ?? prov?.service_category_id ?? 0);
      const resolvedServiceProviderId = Number(prov?.service_provider_id ?? prov?.id ?? 0);

      const rawCategory = prov?.service_category_name ?? prov?.category_name ?? prov?.service_category;
      const resolvedServiceCategory = typeof rawCategory === 'object' && rawCategory?.name
        ? rawCategory.name
        : (typeof rawCategory === 'string' ? rawCategory : 'GENERAL');

      if (!resolvedProviderId || resolvedProviderId <= 0) {
        this.isConfirmingBooking = false;
        this.showToast('Error: No se pudo identificar al proveedor', 'danger');
        return;
      }

      if (!resolvedServiceId || resolvedServiceId <= 0) {
        this.isConfirmingBooking = false;
        this.showToast('Error: No se pudo identificar el servicio', 'danger');
        return;
      }

      const duration = 60;
      const totalPrice = (prov?.hourly_rate ?? 0) * (duration / 60);

      const bookingData: BookingCreate = {
        provider_id: resolvedProviderId,
        service_id: resolvedServiceId,
        service_provider_id: resolvedServiceProviderId > 0 ? resolvedServiceProviderId : undefined,
        scheduled_date: datePart,
        scheduled_time: timePart,
        duration,
        total_price: totalPrice,
        description: this.description || 'Sin descripción',
        location_address: this.locationAddress || 'Mi ubicación actual',
        location_lat: this.userLocation?.lat,
        location_lng: this.userLocation?.lng,
        service_category: resolvedServiceCategory
      };

      this.clientBookingService.createBooking(bookingData).subscribe({
        next: () => {
          this.isConfirmingBooking = false;
          this.showToast('¡Reserva enviada exitosamente!', 'success');
          this.showBookingModal = false;
          this.modalCtrl.dismiss({ action: 'booked' });
        },
        error: (err) => {
          this.isConfirmingBooking = false;
          let errorMsg = 'Error al crear la reserva';
          if (err.error?.detail) errorMsg = err.error.detail;
          else if (err.error?.message) errorMsg = err.error.message;
          this.showToast(errorMsg, 'danger');
        }
      });
    } catch {
      this.isConfirmingBooking = false;
      this.showToast('Error procesando la solicitud', 'danger');
    }
  }

  async startChat() {
    // provider_id = providers.id (FK esperado por el endpoint /chat/conversations/{provider_id})
    // id          = service_providers.id — NO usar como fallback, es un ID de tabla diferente
    const providerId = this.provider?.provider_id;
    if (!providerId) {
      this.showToast('Error: ID de proveedor no disponible', 'danger');
      return;
    }

    this.isStartingChat = true;
    try {
      const conversation = await this.chatService.startConversationWithProvider(providerId).toPromise();
      if (conversation?.id) {
        this.showToast('Chat abierto', 'success');
        this.modalCtrl.dismiss({ action: 'chat' });
        setTimeout(() => this.router.navigate(['/client/chat', conversation.id]), 300);
      }
    } catch {
      this.showToast('No se pudo abrir el chat', 'danger');
    } finally {
      this.isStartingChat = false;
    }
  }

  /**
   * Denunciar perfil del proveedor
   * Muestra un alert para confirmar la denuncia y enviar el reporte al backend
   */
  async reportProvider(): Promise<void> {
    const providerId = this.provider?.provider_id || this.provider?.id;
    if (!providerId) {
      await this.showToast('Error: no se puede denunciar este perfil', 'danger');
      return;
    }

    // Mostrar alert de confirmación con opciones de motivo
    const alert = await this.alertCtrl.create({
      header: 'Denunciar perfil',
      message: '¿Por qué deseas denunciar este perfil?',
      inputs: [
        {
          type: 'radio',
          label: 'Comportamiento inapropiado',
          value: 'inappropriate_behavior',
          checked: true
        },
        {
          type: 'radio',
          label: 'Contenido engañoso o fraudulento',
          value: 'fraud'
        },
        {
          type: 'radio',
          label: 'Spam o publicidad no deseada',
          value: 'spam'
        },
        {
          type: 'radio',
          label: 'Suplantación de identidad',
          value: 'impersonation'
        },
        {
          type: 'radio',
          label: 'Otro motivo',
          value: 'other'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Denunciar',
          handler: async (reason: string) => {
            if (!reason) {
              await this.showToast('Selecciona un motivo', 'warning');
              return false;
            }

            // TODO: Implementar llamada al backend cuando esté disponible
            // Ejemplo: this.reportService.reportProvider(providerId, reason).subscribe(...)
            
            // Por ahora, solo mostramos confirmación
            await this.showToast('Denuncia enviada. Gracias por tu reporte.', 'success');
            console.log(`Proveedor ${providerId} denunciado por: ${reason}`);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Abre el visor de imagen en pantalla completa
   */
  async openImageViewer(imageUrl: string, index: number): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Imagen ${index + 1} de ${this.portfolioImages.length}`,
      message: `<img src="${imageUrl}" style="width:100%;border-radius:8px;margin-top:10px;">`,
      cssClass: 'pas-image-viewer-alert',
      buttons: ['Cerrar']
    });
    await alert.present();
  }

  /**
   * Muestra el modal de paywall para desbloquear servicios premium
   */
  async showPremiumPaywall(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '💎 Hazte Premium',
      message: `
        <div style="text-align:center;padding:10px 0;">
          <p style="font-size:14px;color:var(--ion-color-medium);margin-bottom:16px;">
            Desbloquea la posibilidad de reservar múltiples servicios del mismo proveedor
          </p>
          <div style="background:rgba(255,193,7,0.1);border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="font-size:16px;font-weight:600;color:var(--ion-color-warning);margin:0;">
              $9.990/mes
            </p>
            <p style="font-size:12px;color:var(--ion-color-medium);margin:4px 0 0;">
              Cancela cuando quieras
            </p>
          </div>
          <ul style="text-align:left;font-size:13px;color:var(--ion-color-dark);list-style:none;padding:0;">
            <li style="margin:8px 0;">✓ Reserva ilimitada de servicios</li>
            <li style="margin:8px 0;">✓ Soporte prioritario</li>
            <li style="margin:8px 0;">✓ Sin comisiones adicionales</li>
            <li style="margin:8px 0;">✓ Acceso anticipado a nuevas funciones</li>
          </ul>
        </div>
      `,
      cssClass: 'pas-premium-paywall-alert',
      buttons: [
        {
          text: 'Ahora no',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Suscribirme',
          cssClass: 'alert-button-premium',
          handler: () => {
            // TODO: Implementar navegación a pantalla de suscripción/pago
            this.showToast('Próximamente: Suscripción Premium', 'warning');
            // this.router.navigate(['/premium-subscription']);
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'bottom' });
    await toast.present();
  }

  dismiss() {
    this.modalCtrl.dismiss({ action: 'close' });
  }
}
