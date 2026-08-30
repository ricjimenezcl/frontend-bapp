// src/app/provider/pages/provider-add-service/provider-add-service.page.ts
import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from '../../../shared/validators/custom-validators';
import { IonicModule, ModalController, AlertController, LoadingController, ToastController, ActionSheetController } from '@ionic/angular';
import { Subject, firstValueFrom, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { CoreService } from '../../../shared/services/core.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ProviderService } from '../../services/provider.service';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';
import { CameraService } from '../../../shared/services/camera.service';
import { ContentFilterService } from '../../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../../shared/validators/content-filter.validators';
import { PaymentRedirectService } from '../../../services/payment-redirect.service';
import { environment } from '../../../../environments/environment';

interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

const TIME_OPTIONS: string[] = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}:00`
);

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Interfaces
export interface MainCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface ServiceCategory {
  id: number;
  name: string;
  description: string;
  main_category_id: number;
  icon: string;
  is_active: boolean;
  created_at: string;
}

type ServiceLimitProductType = 'PROVIDER_SERVICE_30' | 'PROVIDER_PREMIUM_MONTHLY' | 'PROVIDER_PREMIUM_ANNUAL';

interface ServiceLimitResult {
  canCreate: boolean;
  suggestedProductType: ServiceLimitProductType;
  message: string;
}

@Component({
  selector: 'app-provider-add-service',
  templateUrl: './provider-add-service.page.html',
  styleUrls: ['./provider-add-service.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class ProviderAddServicePage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private providerProfile: any = null;

  // Servicios inyectados
  private readonly fb           = inject(FormBuilder);
  private readonly modalCtrl    = inject(ModalController);
  private readonly alertCtrl    = inject(AlertController);
  private readonly loadingCtrl  = inject(LoadingController);
  private readonly toastCtrl    = inject(ToastController);
  private readonly mapboxService = inject(MapboxService);
  private readonly coreService  = inject(CoreService);
  private readonly authService  = inject(AuthService);
  private readonly providerService = inject(ProviderService);
  private readonly http = inject(HttpClient);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly paymentRedirect = inject(PaymentRedirectService);

  // Datos recibidos del componente padre
  @Input() mainCategories: MainCategory[] = [];
  @Input() currentUser: any;
  @Input() providerData: any;

  servicioForm: FormGroup;

  // Selección de categoría / servicio (3 pasos inline)
  selectedMainCategoryId: number = 0;
  subcategoryOptions: Array<{ id: number; name: string }> = [];
  selectedSubcategoryId: number = 0;
  selectedServiceId: number = 0;
  selectedService: ServiceCategory | null = null;
  subServices: ServiceCategory[] = [];
  loadingSubServices = false;

  // Disponibilidad (horarios)
  timeOptions = TIME_OPTIONS;
  schedules: DaySchedule[] = [];

  // Dirección autocomplete
  selectedAddressObject: any = null;
  address: any = { place: '', set: false };
  mapUrl: string = '';
  addressSuggestions: any[] = [];
  showAddressSuggestions: boolean = false;
  isSearching: boolean = false;

  // ══ PORTFOLIO IMAGES ═══════════════════════════════════
  portfolioImages: { file: File | null; preview: string; url?: string }[] = [];
  uploadingImages: boolean = false;
  private readonly documentUploadService = inject(DocumentUploadService);
  private readonly cameraService = inject(CameraService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly MAX_PORTFOLIO_IMAGES = 5;
  // ═══════════════════════════════════════════════════════════════════

  constructor() {
    this.servicioForm = this.createForm();
    this.schedules = this.buildDefaultSchedule();
  }

  /** Genera el horario por defecto: Lun-Vie 08:00-20:00, Sáb 08:00-14:00 */
  private buildDefaultSchedule(): DaySchedule[] {
    return DAY_NAMES_ES.map((dayName, i) => ({
      dayOfWeek: i,
      dayName,
      isActive: i <= 4,                      // Lun(0)–Vie(4) activos
      startTime: '08:00',
      endTime: i === 5 ? '14:00' : '20:00',  // Sáb(5) cierra a las 14:00
    }));
  }

  /** Aplica horario por defecto cuando el servicio no tiene horarios guardados (2.5) */
  applyDefaultScheduleIfEmpty(loadedSchedules: DaySchedule[]): void {
    this.schedules = loadedSchedules.length > 0 ? loadedSchedules : this.buildDefaultSchedule();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      servicio: ['', [Validators.required]],
      categoria: ['', [Validators.required]],
      subcategoria: ['', [Validators.required]],
      nombre_prestador: this.fb.control('', {
        validators: [Validators.required, Validators.minLength(5), Validators.maxLength(45)],
        asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'service')],
      }),
      fono: ['', [Validators.required, CustomValidators.phone()]],
      detalle: this.fb.control('', {
        validators: [Validators.maxLength(100)],
        asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'service')],
      }),
      hourly_rate: [null],
      direccion: ['', [Validators.required]],
      lat: ['', [Validators.required]],
      lng: ['', [Validators.required]]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Liberar blob URLs de imágenes del portafolio
    this.portfolioImages.forEach(img => {
      if (img.preview.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      }
    });
  }

  ngOnInit(): void {
    // Verificar autenticación
    if (!this.currentUser || typeof this.currentUser !== 'object' || !this.currentUser.id) {
      this.presentToast('Debe iniciar sesión para agregar servicios', 'danger');
      this.cancel();
      return;
    }

    // Cargar perfil del proveedor para obtener providers.id garantizado
    this.providerService.getMyProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (profile) => {
          this.providerProfile = profile;
          const entitlement = await this.evaluateServiceCreationEntitlement();
          if (!entitlement.canCreate) {
            await this.presentServiceLimitAlert(entitlement);
            this.cancel();
          }
        },
        error: () => { /* no-critical — id_contacto usará fallback */ }
      });

    // Si se proporcionan datos del proveedor, llenar automáticamente algunos campos
    if (this.providerData) {
      this.servicioForm.patchValue({
        nombre_prestador: this.providerData.full_name || '',
        fono: this.providerData.phone || ''
      });
    }

    // Configurar autocompletado de direcciones
    this.setupAutocomplete();

    // Inicializar mapa con ubicación por defecto (Santiago, Chile)
    this.initMap(-33.4489, -70.6693);
  }

  private async evaluateServiceCreationEntitlement(): Promise<ServiceLimitResult> {
    const activeServices = await this.getActiveServicesCount();
    const transactions = await this.getMyTransactions();
    const now = Date.now();

    const activeTypes = (transactions ?? [])
      .filter((tx: any) => this.isActiveTransaction(tx, now))
      .map((tx: any) => this.readProductType(tx));

    const hasPremium = activeTypes.some((pt: string) =>
      pt.includes('PROVIDER_PREMIUM_MONTHLY') ||
      pt.includes('PROVIDER_PREMIUM_ANNUAL') ||
      (pt.includes('PROVIDER_PREMIUM') && (pt.includes('YEAR') || pt.includes('ANNUAL')))
    );

    const hasBasePlan = activeTypes.some((pt: string) =>
      pt.includes('PROVIDER_SERVICE_30') || pt.includes('PROVIDER_SERVICE_YEAR') || pt.includes('PROVIDER_SERVICE_ANNUAL')
    );

    const maxServices = hasPremium ? 7 : hasBasePlan ? 3 : 2;
    if (activeServices < maxServices) {
      return { canCreate: true, suggestedProductType: 'PROVIDER_SERVICE_30', message: '' };
    }

    if (!hasBasePlan && activeServices >= 2) {
      return {
        canCreate: false,
        suggestedProductType: 'PROVIDER_SERVICE_30',
        message: 'Ya alcanzaste los 2 servicios gratuitos. Activa un plan mensual o anual para crear tu tercer servicio.',
      };
    }

    if (!hasPremium && activeServices >= 3) {
      return {
        canCreate: false,
        suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
        message: 'Tu plan actual permite hasta 3 servicios. Activa Premium mensual o anual para llegar hasta 7 servicios activos.',
      };
    }

    return {
      canCreate: false,
      suggestedProductType: 'PROVIDER_PREMIUM_ANNUAL',
      message: 'Ya alcanzaste el máximo de 7 servicios activos para planes Premium.',
    };
  }

  private async getActiveServicesCount(): Promise<number> {
    try {
      const providerId = this.providerProfile?.id ?? this.currentUser?.provider_id ?? this.currentUser?.id;
      if (!providerId) return this.providerService.providerServices().filter(s => s.is_available).length;
      const services = await firstValueFrom(this.providerService.getProviderServices(String(providerId)));
      return (services ?? []).filter((s: any) => !!s?.is_available).length;
    } catch {
      return this.providerService.providerServices().filter(s => s.is_available).length;
    }
  }

  private async getMyTransactions(): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/transactions/me`));
    } catch {
      return [];
    }
  }

  private isActiveTransaction(tx: any, nowMs: number): boolean {
    const status = String(tx?.status ?? '').toLowerCase();
    if (!(status === 'completed' || status === 'authorized')) return false;
    if (!tx?.expires_at) return true;
    const exp = new Date(tx.expires_at).getTime();
    return Number.isFinite(exp) && exp > nowMs;
  }

  private readProductType(tx: any): string {
    return String(tx?.product_type ?? tx?.product?.sku ?? tx?.product?.product_type ?? tx?.sku ?? '').toUpperCase();
  }

  private async presentServiceLimitAlert(result: ServiceLimitResult): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Plan requerido',
      message: result.message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Activar plan',
          role: 'confirm',
          handler: () => {
            this.paymentRedirect.openPayment({
              productType: result.suggestedProductType,
              returnTo: '/provider/tabs/service-details',
              action: 'add-service',
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ── Selección inline 3 pasos (categoría → subcategoría → servicio) ──────

  /** Paso 1: usuario cambia categoría principal → cargar subcategorías */
  onMainCategoryChange(event: any): void {
    const id = Number(event?.detail?.value ?? 0);
    this.selectedMainCategoryId = id;
    this.servicioForm.patchValue({ subcategoria: '', categoria: '' });
    this.selectedSubcategoryId = 0;
    this.selectedServiceId = 0;
    this.selectedService = null;
    this.subcategoryOptions = [];
    this.subServices = [];
    if (!id) return;

    this.loadingSubServices = true;
    this.coreService.getSubcategories(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subs) => {
          this.subcategoryOptions = subs;
          this.loadingSubServices = false;
        },
        error: () => {
          this.subcategoryOptions = [];
          this.loadingSubServices = false;
          this.presentToast('Error al cargar subcategorías', 'danger');
        }
      });
  }

  /** Paso 2: usuario selecciona subcategoría → cargar servicios */
  onSubcategoryChange(event: any): void {
    const id = Number(event?.detail?.value ?? 0);
    this.selectedSubcategoryId = id;
    this.servicioForm.patchValue({ categoria: '' });
    this.selectedServiceId = 0;
    this.selectedService = null;
    this.subServices = [];
    if (!id) return;

    this.loadingSubServices = true;
    this.coreService.getServicesBySubcategory(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (services) => {
          this.subServices = services.map(s => ({
            id: s.service_category_id ?? s.id,
            name: s.name,
            description: s.description ?? '',
            main_category_id: this.selectedMainCategoryId,
            icon: s.icon ?? '',
            is_active: true,
            created_at: '',
          }));
          this.loadingSubServices = false;
        },
        error: () => {
          this.subServices = [];
          this.loadingSubServices = false;
          this.presentToast('Error al cargar servicios', 'danger');
        }
      });
  }

  /** Paso 3: usuario selecciona servicio específico */
  onServiceChange(event: any): void {
    const id = Number(event?.detail?.value ?? 0);
    this.selectedServiceId = id;
    this.selectedService = this.subServices.find(s => s.id === id) ?? null;
  }

  // Configurar autocompletado de direcciones
  private setupAutocomplete() {
    // Escuchar cambios en el control de dirección del formulario
    const direccionControl = this.servicioForm.get('direccion');
    if (!direccionControl) {
      console.warn('❌ Control de dirección no encontrado');
      return;
    }

    direccionControl.valueChanges.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap((term: string) => {
        if (!term || term.length < 3) {
          this.addressSuggestions = [];
          this.showAddressSuggestions = false;
          this.isSearching = false;
          return of([]); // Usar of([]) para emitir observable vacío
        }
        
        this.isSearching = true;
        return this.mapboxService.autocompleteChile(term);
      })
    ).subscribe({
      next: (suggestions: any[]) => {
        this.addressSuggestions = suggestions;
        this.showAddressSuggestions = suggestions.length > 0;
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error en autocompletado:', error);
        this.addressSuggestions = [];
        this.showAddressSuggestions = false;
        this.isSearching = false;
        this.cdr.detectChanges();
      }
    });
  }



  // Inicializar mapa
  private async initMap(lat: number, lng: number) {
    try {
      // Usar OpenStreetMap para el mapa estático
      this.mapUrl = this.mapboxService.getStaticMapUrl(lat, lng);
      console.log('Mapa inicializado en:', lat, lng);
    } catch (error) {
      console.error('Error initializing map:', error);
      this.mapUrl = this.mapboxService.getStaticMapUrl(-33.4489, -70.6693); // Fallback a Santiago
    }
  }



  // Actualizar mapa
  private updateMap(lat: number, lng: number) {
    this.mapUrl = this.mapboxService.getStaticMapUrl(lat, lng);
  }

  // Métodos para el input de dirección
  onAddressFocus() {
    if (this.addressSuggestions.length > 0) {
      this.showAddressSuggestions = true;
      this.cdr.detectChanges();
    }
  }

  onAddressBlur() {
    setTimeout(() => {
      this.showAddressSuggestions = false;
    }, 200);
  }

  selectAddressSuggestion(suggestion: any) {
    this.selectedAddressObject = suggestion;
    const displayText = this.getSuggestionDisplayText(suggestion);
    
    // Las coordenadas están en suggestion.center [lon, lat]
    const lon = suggestion.center[0];
    const lat = suggestion.center[1];
    
    // Actualizar el formulario
    this.servicioForm.patchValue({
      direccion: displayText,
      lat: lat.toString(),
      lng: lon.toString()
    }, { emitEvent: false }); // emitEvent: false para no triggerar valueChanges
    
    this.address.place = displayText;
    this.address.set = true;
    this.showAddressSuggestions = false;
    this.addressSuggestions = [];
    
    // Actualizar mapa
    this.updateMap(lat, lon);
  }

  clearAddress() {
    this.selectedAddressObject = null;
    this.address.set = false;
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    
    this.servicioForm.patchValue({
      direccion: '',
      lat: '',
      lng: ''
    });
    
    // Resetear mapa a Santiago
    this.initMap(-33.4489, -70.6693);
  }

  // Métodos de utilidad
  getError(controlName: string): string {
    const control = this.servicioForm.get(controlName);
    return CustomValidators.getErrorMessage(control);
  }

  formatPhone(event: any): void {
    let value = event.target.value.replace(/\D/g, '');

    // Eliminar código de país si está al inicio
    if (value.startsWith('56')) {
      value = value.substring(2);
    }

    // Limitar a 9 dígitos (9 + 8 dígitos reales)
    value = value.substring(0, 9);

    // Formatear progresivamente: +56 9 XXXX XXXX
    if (value.length > 0) {
      if (value.length <= 1) {
        value = `+56 9 ${value}`;
      } else if (value.length <= 5) {
        value = `+56 9 ${value.substring(1, 5)}`;
      } else {
        value = `+56 9 ${value.substring(1, 5)} ${value.substring(5, 9)}`;
      }
    }

    this.servicioForm.patchValue({ fono: value });
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

  // Métodos de UI
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // Enviar servicio
  // async submitService() {
  //   if (this.servicioForm.valid && this.currentUser) {
  //     const loading = await this.loadingCtrl.create({
  //       message: 'Guardando servicio...'
  //     });
  //     await loading.present();

  //     try {
  // Enviar servicio al backend
  async submitService() {
    if (this.servicioForm.pending) {
      this.servicioForm.markAllAsTouched();
      await this.presentToast('Validando contenido...', 'primary');
      return;
    }

    if (this.servicioForm.valid && this.currentUser) {
      const loading = await this.loadingCtrl.create({
        message: 'Guardando servicio...'
      });
      await loading.present();

      try {
        // ══ SUBIR IMÁGENES DE PORTAFOLIO PRIMERO ═══════════════════════
        let portfolioUrls: string[] = [];
        
        if (this.portfolioImages.length > 0) {
          loading.message = 'Subiendo imágenes...';
          try {
            portfolioUrls = await this.uploadPortfolioImages();
            console.log('Imágenes subidas:', portfolioUrls);
          } catch (error) {
            console.error('Error subiendo imágenes:', error);
            await loading.dismiss();
            await this.presentToast('Error al subir imágenes. Intenta nuevamente.', 'danger');
            return;
          }
        }
        // ═══════════════════════════════════════════════════════════════

        loading.message = 'Guardando servicio...';
        const formData = this.servicioForm.value;
        const fono = formData.fono.replace(/\s/g, '');

        const serviceData: any = {
          servicio: Number.parseInt(formData.servicio),
          categoria: Number.parseInt(formData.categoria),
          nombre_prestador: formData.nombre_prestador,
          fono: fono,
          detalle: formData.detalle || '',
          direccion: formData.direccion,
          lat: Number.parseFloat(formData.lat),
          lng: Number.parseFloat(formData.lng),
          hourly_rate: formData.hourly_rate ? Number.parseFloat(formData.hourly_rate) : null,
          id_contacto: this.providerProfile?.id ?? this.currentUser.id
        };

        // ══ INCLUIR PORTFOLIO IMAGES SI EXISTEN ════════════════════════
        if (portfolioUrls.length > 0) {
          serviceData.portfolio_images = portfolioUrls;
        }
        // ═══════════════════════════════════════════════════════════════

        console.log('Enviando datos al backend:', serviceData);

        if (this.coreService) {
          this.coreService.createServiceProvider(serviceData).subscribe({
            next: (response) => {
              this.saveSchedules(response).then(() => {
                loading.dismiss();
                this.presentToast('Servicio guardado correctamente', 'success');
                this.servicioForm.reset();
                this.portfolioImages = []; // Limpiar imágenes
                this.modalCtrl.dismiss({ success: true, data: response }, 'confirm');
              });
            },
            error: async (error) => {
              loading.dismiss();
              console.error('Error guardando servicio:', error);

              if (error.status === 403) {
                const isProfileIncomplete = error.error?.detail?.includes('Perfil incompleto');
                await this.presentAlert(
                  isProfileIncomplete ? 'Perfil incompleto' : 'Verificación de identidad requerida',
                  error.error?.detail || 'Debes completar la verificación de identidad antes de agregar servicios. Por favor, ve a la sección de verificación y sube tu selfie y documento de identidad.'
                );
                return;
              }

              if (error.status === 402) {
                await this.presentAlert(
                  'Límite de servicios gratuitos',
                  error.error?.detail || 'Has alcanzado el máximo de 2 servicios gratuitos. Actualiza tu plan para agregar más.'
                );
                return;
              }

              let errorMessage = 'No se pudo guardar el servicio';
              if (error.error?.detail) {
                errorMessage = error.error.detail;
              } else if (error.status === 404) {
                errorMessage = 'No se encontró el perfil de proveedor. Complete su registro primero.';
              } else if (error.status === 401) {
                errorMessage = 'Sesión expirada. Por favor inicie sesión nuevamente.';
              }

              this.presentToast(errorMessage, 'danger');
            }
          });
        }
      } catch (error) {
        loading.dismiss();
        console.error('Error al procesar el formulario:', error);
        this.presentToast('Error al procesar el formulario', 'danger');
      }
    } else {
      Object.keys(this.servicioForm.controls).forEach(key => {
        const control = this.servicioForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
      this.presentToast('Por favor complete todos los campos requeridos', 'warning');
    }
  }

  // ══ PORTFOLIO IMAGES METHODS ══════════════════════════════════════════════
  
  /**
   * Muestra action sheet para elegir fuente de imagen
   */
  async selectImageSource(): Promise<void> {
    if (this.portfolioImages.length >= this.MAX_PORTFOLIO_IMAGES) {
      await this.presentToast(`Máximo ${this.MAX_PORTFOLIO_IMAGES} imágenes permitidas`, 'warning');
      return;
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar fuente',
      buttons: [
        {
          text: 'Cámara',
          icon: 'camera-outline',
          handler: () => {
            this.addImageFromCamera();
          }
        },
        {
          text: 'Galería',
          icon: 'images-outline',
          handler: () => {
            this.addImageFromGallery();
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * Toma foto con la cámara
   */
  async addImageFromCamera(): Promise<void> {
    try {
      const base64Data = await this.cameraService.takePicture();
      if (base64Data) {
        await this.processAndAddImage(base64Data);
      }
    } catch (error) {
      console.error('Error al tomar foto:', error);
      await this.presentToast('Error al tomar foto', 'danger');
    }
  }

  /**
   * Selecciona imagen desde galería
   */
  async addImageFromGallery(): Promise<void> {
    try {
      const base64Data = await this.cameraService.selectFromGallery();
      if (base64Data) {
        await this.processAndAddImage(base64Data);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      await this.presentToast('Error al seleccionar imagen', 'danger');
    }
  }

  /**
   * Procesa y valida la imagen antes de agregarla
   */
  private async processAndAddImage(base64Data: string): Promise<void> {
    try {
      // Convertir base64 a File para validación
      const file = this.base64ToFile(base64Data, 'portfolio-image.jpg');
      
      // Validar imagen usando DocumentUploadService
      const validation = await this.documentUploadService.validateImage(file);
      
      if (!validation.valid) {
        await this.presentToast(validation.error || 'Imagen no válida', 'danger');
        return;
      }

      // Usar blob URL como preview para evitar errores 431 con base64 muy largo
      // (Angular puede sanitizar data URLs con MIME genérico como application/octet-stream)
      const blobPreview = URL.createObjectURL(file);

      this.portfolioImages.push({
        file: file,
        preview: blobPreview
      });

      await this.presentToast('Imagen agregada', 'success');
      
    } catch (error) {
      console.error('Error procesando imagen:', error);
      await this.presentToast('Error al procesar imagen', 'danger');
    }
  }

  /**
   * Convierte base64 a File
   */
  private base64ToFile(base64: string, filename: string): File {
    // Extraer el tipo MIME y los datos
    const arr = base64.split(',');
    const regexResult = /:(.*?);/.exec(arr[0]);
    const mime = regexResult?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.codePointAt(n) || 0;
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Elimina una imagen del array
   */
  removeImage(index: number): void {
    if (index >= 0 && index < this.portfolioImages.length) {
      const img = this.portfolioImages[index];
      if (img.preview.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      }
      this.portfolioImages.splice(index, 1);
      this.presentToast('Imagen eliminada', 'success');
    }
  }

  /**
   * Sube todas las imágenes del portafolio a Cloudinary
   * Retorna array de URLs de Cloudinary
   */
  private async uploadPortfolioImages(): Promise<string[]> {
    if (this.portfolioImages.length === 0) {
      return [];
    }

    this.uploadingImages = true;
    const uploadedUrls: string[] = [];

    try {
      // Subir cada imagen secuencialmente
      for (let i = 0; i < this.portfolioImages.length; i++) {
        const img = this.portfolioImages[i];
        
        if (!img.file) {
          console.warn(`Imagen ${i} no tiene file, saltando`);
          continue;
        }

        try {
          // Generar firma de Cloudinary
          const signature = await firstValueFrom(this.documentUploadService.generateUploadSignature('portfolio'));
          
          if (!signature) {
            throw new Error('No se pudo generar firma de subida');
          }

          // Crear FormData para Cloudinary
          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('api_key', signature.api_key);
          formData.append('timestamp', signature.timestamp.toString());
          formData.append('signature', signature.signature);
          formData.append('folder', 'portfolio');

          // Subir a Cloudinary directamente
          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
            {
              method: 'POST',
              body: formData
            }
          );

          const data = await response.json();
          
          if (data.secure_url) {
            uploadedUrls.push(data.secure_url);
          } else {
            console.error('Respuesta sin URL:', data);
          }
          
        } catch (error) {
          console.error(`Error subiendo imagen ${i}:`, error);
        }
      }

      this.uploadingImages = false;
      return uploadedUrls;
      
    } catch (error) {
      this.uploadingImages = false;
      console.error('Error general en upload:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════

  // Guardar horarios activos para el servicio recién creado
  private async saveSchedules(serviceResponse: any): Promise<void> {
    const spId: number = serviceResponse?.id;
    const providerId: number = serviceResponse?.provider_id;
    if (!spId || !providerId) return;

    const activeDays = this.schedules.filter(d => d.isActive);
    for (const day of activeDays) {
      try {
        await firstValueFrom(this.coreService.upsertServiceSchedule(providerId, spId, {
          day_of_week: day.dayOfWeek,
          start_time: day.startTime,
          end_time: day.endTime,
          is_available: true,
        }));
      } catch (e) {
        console.error(`Error guardando horario día ${day.dayOfWeek}:`, e);
      }
    }
  }

  // Métodos para cerrar el modal
  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.submitService();
  }
}