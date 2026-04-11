// src/app/client/pages/provider-info/provider-info.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController, LoadingController, AlertController, ModalController, IonDatetime  } from '@ionic/angular';
import { CoreService, ServiceProvider } from '../../../shared/services/core.service'; // Keeping CoreService for provider info fetch
import { SelectionService } from '../../../shared/services/selection.service';
import { AuthService } from '../../../auth/services/auth.service';
import { StateService } from '../../../shared/services/state.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MapboxService } from '../../../shared/services/mapbox.service';

// New Service & Models
import { ClientBookingService } from '../../services/client-booking.service';
import { BookingCreate } from '../../../core/models/booking.model';
import { ChatService } from '../../../core/services/chat.service';
import { Review, TimeSlot } from '../../../shared/services/core.service';

@Component({
  selector: 'app-provider-info',
  templateUrl: './provider-info.page.html',
  styleUrls: ['./provider-info.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ProviderInfoPage implements OnInit {

  provider: ServiceProvider | null = null;
  isLoading = true;
  reviews: Review[] = [];
  isLoadingReviews = false;

  // Slots de disponibilidad por servicio
  slots: TimeSlot[] = [];
  isLoadingSlots = false;

  // Form Booking Data
  selectedDate: string = '';
  selectedTime: string = '';
  description: string = '';
  locationAddress: string = '';
  selectedService: any = null;  // Selected service for booking
  selectedServiceId: number = 1; // Service ID from queryParams or default
  serviceHourlyRate: number = 0;
  showDateTimeModal: boolean = false;
  showBookingModal: boolean = false;

  userLocation: { lat: number; lng: number } | null = null;

  // Address autocomplete variables
  selectedAddressText: string = '';
  selectedAddressObject: any = null;
  addressSuggestions: any[] = [];
  showAddressSuggestions: boolean = false;
  private searchTerms = new Subject<string>();
  isSearching: boolean = false;

  // Control flags for location flow
  private hasShownLocationPrompt: boolean = false;
  private useManualAddress: boolean = false;
  dateTime2: string = '';
  fechaHoraFormateada: string = '';

  // DateTime restrictions
  minDate: string = '';

  // Chat
  isStartingChat = false;

  // Validación de reserva
  bookingAttempted = false;

  get isBookingValid(): boolean {
    return !!this.selectedDate && !!this.selectedTime && !!this.locationAddress;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private coreService: CoreService,
    private clientBookingService: ClientBookingService,
    private stateService: StateService,
    private selectionService: SelectionService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private mapboxService: MapboxService,
    private chatService: ChatService,
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {

    const providerId = this.route.snapshot.paramMap.get('id');
    let serviceId: number | null = null;

    // Capturar service_id de queryParams o usar el de selectedProvider
    this.route.queryParams.subscribe(params => {
      if (params['service_id']) {
        serviceId = parseInt(params['service_id']);
        this.selectedServiceId = serviceId;
      }
    });

    

    // Load Provider
    if (providerId) {
      this.loadProvider(parseInt(providerId), serviceId);
    } else {
      const selected = this.coreService.selectedProvider();
      if (selected) {
        this.provider = selected;
        this.isLoading = false;
      }
    }

    // Default Date (Tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.selectedDate = tomorrow.toISOString();
    this.minDate = tomorrow.toISOString(); // Set minimum date for datetime picker

    // Setup address autocomplete subscription (always active, but controlled by useManualAddress flag)
    this.setupAutocomplete();
  }

  

  private setupAutocomplete() {
    console.log('[DEBUG] setupAutocomplete() called - subscription created');
    
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        console.log('[DEBUG] searchTerms received term:', term);
        if (term.length < 3) {
          this.addressSuggestions = [];
          this.showAddressSuggestions = false;
          return [];
        }
        this.isSearching = true;
        console.log('[DEBUG] Calling mapboxService.autocompleteChile()');
        return this.mapboxService.autocompleteChile(term);
      })
    ).subscribe({
      next: (suggestions: any[]) => {
        console.log('[DEBUG] Suggestions received:', suggestions.length, suggestions);
        this.addressSuggestions = suggestions;
        this.showAddressSuggestions = suggestions.length > 0;
        this.isSearching = false;
        console.log('[DEBUG] showAddressSuggestions:', this.showAddressSuggestions);
      },
      error: (error) => {
        console.error('[DEBUG] Error en autocompletado:', error);
        this.addressSuggestions = [];
        this.showAddressSuggestions = false;
        this.isSearching = false;
      }
    });
  }

  async askForLocationUsage() {
    console.log('[DEBUG] askForLocationUsage() called');
    
    const alert = await this.alertCtrl.create({
      header: 'Ubicación del servicio',
      message: '¿Deseas usar tu ubicación actual o agregar una dirección?',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Usar ubicación actual',
          handler: () => {
            console.log('[DEBUG] User selected: Usar ubicación actual');
            this.useManualAddress = false;
            this.useCurrentLocation();
          }
        },
        {
          text: 'Agregar dirección',
          handler: () => {
            console.log('[DEBUG] User selected: Agregar dirección');
            this.useManualAddress = true;
            this.locationAddress = '';
            this.selectedAddressText = '';
            console.log('[DEBUG] useManualAddress set to:', this.useManualAddress);
          }
        }
      ]
    });
    await alert.present();
  }

  useCurrentLocation() {
    if (!this.userLocation) return;
    
    this.locationAddress = 'Mi ubicación actual';
    this.selectedAddressText = 'Mi ubicación actual';
    this.selectedAddressObject = {
      center: [this.userLocation.lng, this.userLocation.lat],
      place_name: 'Mi ubicación actual'
    };
  }

  loadProvider(providerId: number, serviceId: number | null = null) {
    this.isLoading = true;

    // ÚNICA FUENTE DE DATOS: /providers/{id}/detailed
    // Este endpoint retorna:
    // - provider info (id, full_name, email, status, bio, avatar, run, rating_avg, total_reviews)
    // - services array con detalles de cada servicio
    // - reviews array con reseñas del proveedor
    this.coreService.getProviderById(providerId).subscribe({
      next: (providerData) => {
        if (providerData) {
          const pd: any = providerData;
          console.log('[PROVIDER-INFO] Datos completos recibidos de /providers/{id}/detailed:', pd);
          
          const services: any[] = pd.services || [];
          console.log('[PROVIDER-INFO] Servicios disponibles:', services.length);

          // Buscar el servicio específico o usar el primero disponible
          const targetService = serviceId
            ? (services.find((s: any) => s.service_id === serviceId || s.id === serviceId) || services[0])
            : services[0];

          if (targetService) {
            this.provider = {
              ...targetService,
              // IDs
              provider_id: targetService.provider_id || pd.id,
              user_id: pd.user_id || targetService.user_id,
              // Datos del proveedor (nivel raíz de /providers/{id}/detailed)
              full_name: pd.full_name || targetService.full_name,
              run: pd.run,
              status: pd.status,
              bio: pd.bio || '',
              email: pd.email || '',
              avatar: pd.avatar || targetService.avatar,
              phone: targetService.phone || pd.phone,
              // Rating y reviews (desde nivel raíz del endpoint)
              rating: pd.rating_avg || targetService.rating_avg || 0,
              rating_avg: pd.rating_avg || targetService.rating_avg || 0,
              total_reviews: pd.total_reviews || targetService.total_reviews || 0,
              // Datos del servicio seleccionado
              business_name: targetService.business_name,
              address: targetService.address,
              description: targetService.description,
              hourly_rate: targetService.hourly_rate,
              is_available: targetService.is_available,
              validation_status: targetService.validation_status,
              lat: targetService.latitude,
              lng: targetService.longitude,
              distance: targetService.distance
            } as ServiceProvider;

            console.log('[PROVIDER-INFO] Provider mappeado:', this.provider);

            const svcId = targetService.service_id || targetService.service_category_id || targetService.id;
            if (svcId) this.selectedServiceId = Number(svcId);
          } else {
            this.provider = { 
              ...pd, 
              email: pd.email || '',
              avatar: pd.avatar || '',
              status: pd.status,
              bio: pd.bio || '',
              full_name: pd.full_name,
              run: pd.run
            } as ServiceProvider;
          }

          // VALIDACIÓN: Reviews SIEMPRE del endpoint /providers/{id}/detailed
          if (pd.reviews && Array.isArray(pd.reviews)) {
            this.reviews = (pd.reviews) as Review[];
            console.log('[PROVIDER-INFO] Reviews obtenidas de /providers/{id}/detailed:', this.reviews.length, 'reseñas');
          } else {
            this.reviews = [];
            console.warn('[PROVIDER-INFO] No hay reviews en la respuesta de /providers/{id}/detailed');
          }
        }

        this.isLoading = false;
      },
      error: (error) => {
        console.error('[PROVIDER-INFO] Error cargando datos de /providers/{id}/detailed:', error);
        this.isLoading = false;
        this.showToast('Error al cargar información del proveedor');
      }
    });
  }

  selectTime(time: string) {
    this.selectedTime = time;
  }

  onAddressFocus() {
    console.log('[DEBUG] onAddressFocus() - hasShownLocationPrompt:', this.hasShownLocationPrompt, 'useManualAddress:', this.useManualAddress);
    
    // First interaction: show location prompt
    if (!this.hasShownLocationPrompt) {
      this.hasShownLocationPrompt = true;
      
      // Load user location from state
      const savedLoc = this.stateService.getUserLocation();
      console.log('[DEBUG] savedLoc from stateService:', savedLoc);
      if (savedLoc) {
        this.userLocation = { lat: savedLoc.latitude, lng: savedLoc.longitude };
      }
      
      this.askForLocationUsage();
      return;
    }

    // Subsequent interactions: only show suggestions if manual address mode
    if (this.useManualAddress && this.addressSuggestions.length > 0) {
      this.showAddressSuggestions = true;
      console.log('[DEBUG] Showing existing suggestions');
    }
  }

  onAddressInput(event: any) {
    console.log('[DEBUG] onAddressInput() - useManualAddress:', this.useManualAddress);
    
    // Only process if manual address mode is active
    if (!this.useManualAddress) {
      console.log('[DEBUG] Returning early - useManualAddress is false');
      return;
    }

    const query = event.target.value;
    console.log('[DEBUG] Query value:', query, 'length:', query.length);
    
    this.selectedAddressText = query;
    this.locationAddress = query;
    
    if (this.selectedAddressObject && query !== this.getSuggestionDisplayText(this.selectedAddressObject)) {
      this.selectedAddressObject = null;
    }
    
    if (query.length >= 3) {
      console.log('[DEBUG] Query >= 3 chars, emitting to searchTerms');
      this.isSearching = true;
      this.showAddressSuggestions = true;
      this.searchTerms.next(query);
    } else {
      this.showAddressSuggestions = false;
      this.addressSuggestions = [];
    }
  }

  onAddressBlur() {
    // Only process if manual address mode is active
    if (!this.useManualAddress) {
      return;
    }

    setTimeout(() => {
      if (this.selectedAddressObject && !this.selectedAddressText) {
        this.selectedAddressText = this.getSuggestionDisplayText(this.selectedAddressObject);
        this.locationAddress = this.selectedAddressText;
      }
      this.showAddressSuggestions = false;
    }, 200);
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
    this.userLocation = null;
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    this.useManualAddress = false;
    this.hasShownLocationPrompt = false;
    console.log('[DEBUG] clearAddress() - Reset all address state variables');
  }

  getSuggestionIcon(suggestion: any): string {
    const types = suggestion.place_type || [];
    if (types.includes('place')) return 'business';
    if (types.includes('locality')) return 'location';
    if (types.includes('region')) return 'map';
    if (types.includes('address')) return 'home';
    if (types.includes('poi')) return 'flag';
    return 'pin';
  }

  getSuggestionColor(suggestion: any): string {
    const types = suggestion.place_type || [];
    if (types.includes('place')) return 'primary';
    if (types.includes('locality')) return 'secondary';
    if (types.includes('region')) return 'tertiary';
    if (types.includes('address')) return 'success';
    return 'medium';
  }

  getSuggestionContext(suggestion: any): string {
    if (suggestion.place_name && suggestion.text) {
      const parts = suggestion.place_name.split(',');
      if (parts.length > 1) {
        return parts.slice(1).join(',').trim();
      }
    }
    return '';
  }

  getSuggestionDisplayText(suggestion: any): string {
    if (suggestion.text && suggestion.address) {
      return `${suggestion.text} ${suggestion.address}`;
    }
    if (suggestion.place_name) {
      return suggestion.place_name;
    }
    if (suggestion.text) {
      return suggestion.text;
    }
    return 'Dirección desconocida';
  }

  // async bookService() {
  //   if (!this.provider) {
  //     this.showToast('No se ha seleccionado un proveedor');
  //     return;
  //   }

  //   if (!this.selectedDate || !this.selectedTime) {
  //     this.showToast('Por favor selecciona fecha y hora');
  //     return;
  //   }

  //   if (!this.locationAddress) {
  //     this.showToast('Por favor ingresa una dirección');
  //     return;
  //   }
  // }
  
  openDateTimeModal() {
    this.showDateTimeModal = true;
  }

  closeDateTimeModal() {
    this.showDateTimeModal = false;
  }

  confirmDateTime() {
    // Validate that date and time are selected
    if (!this.selectedDate || !this.selectedTime) {
      this.showToast('Por favor selecciona fecha y hora', 'warning');
      return;
    }
    this.closeDateTimeModal();
  }

  bookService = async () => {
    this.bookingAttempted = true;

    // Check auth
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.showToast('Debes iniciar sesión para reservar');
      this.router.navigate(['/auth/login']);
      return;
    }

    // Validate provider
    if (!this.provider) {
      this.showToast('No se ha seleccionado un proveedor');
      return;
    }

    // Validate required fields
    if (!this.selectedDate || !this.selectedTime) {
      this.showToast('Por favor completa fecha y hora', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Confirmando reserva...'
    });
    await loading.present();

    try {
      // Extract date part (YYYY-MM-DD format)
      const datePart = this.selectedDate.includes('T') 
        ? this.selectedDate.split('T')[0] 
        : this.selectedDate;

      // Ensure time format is HH:mm:ss (exact format backend expects)
      let timePart = this.selectedTime;
      if (timePart.length === 5) {
        timePart = `${timePart}:00`;
      }

      const duration = 60; // Default 1 hour in minutes
      const totalPrice = (this.provider?.hourly_rate || 0) * (duration / 60); // Calculate price

      // Resolve provider_id with fallback chain
      const resolvedProviderId = Number(
        this.provider.provider_id || this.provider.id || 0
      );

      // Resolve service_id: use selectedServiceId if set from queryParams, otherwise try provider data
      const providerAny = this.provider as any;
      const resolvedServiceId = this.selectedServiceId > 1
        ? this.selectedServiceId
        : Number(providerAny.service_id || providerAny.service_category_id || this.selectedServiceId);

      // Validate required fields before sending
      if (!resolvedProviderId || resolvedProviderId <= 0) {
        loading.dismiss();
        this.showToast('Error: No se pudo identificar al proveedor', 'danger');
        console.error('provider_id is invalid:', { provider_id: this.provider.provider_id, id: this.provider.id });
        return;
      }

      if (!resolvedServiceId || resolvedServiceId <= 0) {
        loading.dismiss();
        this.showToast('Error: No se pudo identificar el servicio', 'danger');
        console.error('service_id is invalid:', { selectedServiceId: this.selectedServiceId, provider: this.provider });
        return;
      }

      // Resolve service_provider_id (the service_providers table row)
      const resolvedServiceProviderId = Number(
        (this.provider as any).service_provider_id || this.provider.id || 0
      );

      // Resolve service_category name (ensure it's a string, not an object)
      const rawCategory = (this.provider as any).service_category_name
        || (this.provider as any).category_name
        || (this.provider as any).service_category;
      const resolvedServiceCategory = typeof rawCategory === 'object' && rawCategory?.name
        ? rawCategory.name
        : (typeof rawCategory === 'string' ? rawCategory : 'GENERAL');

      // Build booking payload exactly as backend expects
      const bookingData: BookingCreate = {
        provider_id: resolvedProviderId,                                    // Provider ID (providers.id)
        service_id: resolvedServiceId,                                      // Service ID (service_categories.id)
        service_provider_id: resolvedServiceProviderId > 0 ? resolvedServiceProviderId : undefined, // service_providers.id
        scheduled_date: datePart,                                           // YYYY-MM-DD
        scheduled_time: timePart,                                           // HH:mm:ss
        duration: duration,                                                 // minutes (int)
        total_price: totalPrice,                                            // numeric value
        description: this.description || 'Sin descripción',                 // optional string
        location_address: this.locationAddress || 'Mi ubicación actual',   // Client location address
        location_lat: this.userLocation?.lat || undefined,                 // Client location latitude
        location_lng: this.userLocation?.lng || undefined,                 // Client location longitude
        service_category: resolvedServiceCategory                          // Category name string
      };

      console.log('📤 Sending booking data:', JSON.stringify(bookingData, null, 2));
      console.log('🔍 Provider debug:', {
        'provider.id': this.provider.id,
        'provider.provider_id': this.provider.provider_id,
        'provider.service_id': (this.provider as any).service_id,
        'provider.service_category_id': (this.provider as any).service_category_id,
        'selectedServiceId': this.selectedServiceId,
        'resolvedProviderId': resolvedProviderId,
        'resolvedServiceId': resolvedServiceId
      });

      this.clientBookingService.createBooking(bookingData).subscribe({
        next: (response) => {
          loading.dismiss();
          console.log('✅ Booking created successfully:', response);
          this.showToast('¡Reserva enviada exitosamente!', 'success');
          
          // Cerrar el modal antes de navegar
          this.showBookingModal = false;
          this.bookingAttempted = false;
          
          this.selectionService.clearAll();
          setTimeout(() => this.router.navigate(['/client/tabs']), 1000);
        },
        error: (err) => {
          loading.dismiss();
          console.error('❌ Booking error:', err);
          console.error('Error response:', err.error);
          
          // Extract detailed error message
          let errorMsg = 'Error al crear la reserva';
          if (err.error?.detail) {
            errorMsg = err.error.detail;
          } else if (err.error?.message) {
            errorMsg = err.error.message;
          } else if (typeof err.error === 'string') {
            errorMsg = err.error;
          }
          
          this.showToast(errorMsg, 'danger');
        }
      });

    } catch (e) {
      loading.dismiss();
      console.error('❌ Exception:', e);
      this.showToast('Error procesando la solicitud', 'danger');
    }
  }

  async startChat() {
    if (!this.provider) {
      this.showToast('Error: Proveedor no disponible', 'danger');
      return;
    }

    console.log('🔍 [startChat] Provider object:', this.provider);
    console.log('🔍 [startChat] provider.provider_id:', this.provider.provider_id);
    console.log('🔍 [startChat] provider.user_id:', this.provider.user_id);

    if (!this.provider.provider_id) {
      console.error('❌ [startChat] ERROR: provider_id is undefined or null');
      this.showToast('Error: ID de proveedor no disponible', 'danger');
      return;
    }

    this.isStartingChat = true;

    try {
      // Start conversation with provider using provider_id (OPCIÓN B: providers.id, not user_id)
      console.log(`📞 [startChat] Iniciando conversación con provider_id=${this.provider.provider_id}`);
      const conversation = await this.chatService.startConversationWithProvider(this.provider.provider_id).toPromise();
      
      if (conversation && conversation.id) {
        const conversationId = conversation.id;
        console.log('✅ Conversation started:', conversationId);
        this.showToast('Chat abierto', 'success');
        
        // Navigate to chat page
        setTimeout(() => {
          this.router.navigate(['/client/chat', conversationId]);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error starting chat:', error);
      this.showToast('No se pudo abrir el chat', 'danger');
    } finally {
      this.isStartingChat = false;
    }
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  goBack() {
    this.router.navigate(['/client/tabs']);
  }

  // ==================== BOOKING MODAL METHODS ====================

  openBookingActionSheet() {
    console.log('📋 Opening booking modal');
    this.showBookingModal = true;
    // Cargar slots para la fecha actualmente seleccionada
    this.loadAvailableSlots();
  }

  onDateChange() {
    this.selectedTime = '';
    this.loadAvailableSlots();
  }

  private loadAvailableSlots() {
    if (!this.selectedDate || !this.provider) return;

    const providerId = Number((this.provider as any).provider_id || this.provider.id || 0);
    const spId = Number((this.provider as any).service_provider_id || this.provider.id || 0);
    if (!providerId || !spId) return;

    // Formato YYYY-MM-DD
    const datePart = this.selectedDate.includes('T')
      ? this.selectedDate.split('T')[0]
      : this.selectedDate;

    this.isLoadingSlots = true;
    this.slots = [];
    this.coreService.getAvailableSlots(providerId, spId, datePart).subscribe({
      next: (response) => {
        this.slots = response.slots;
        this.isLoadingSlots = false;
      },
      error: () => {
        this.slots = [];
        this.isLoadingSlots = false;
      }
    });
  }

  closeBookingActionSheet() {
    console.log('📋 Closing booking modal');
    this.showBookingModal = false;
    this.bookingAttempted = false; // Reset validation flag
  }

  confirmBookingFromSheet() {
    console.log('📋 Confirming booking from modal');
    this.bookService(); // Reutiliza el método existente
    // Si bookService() es exitoso, el modal se cierra automáticamente
    // porque navega a /client/tabs
  }
}