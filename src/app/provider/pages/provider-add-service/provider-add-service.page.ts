// src/app/provider/pages/provider-add-service/provider-add-service.page.ts
import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from '../../../shared/validators/custom-validators';
import { IonicModule, ModalController, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { ProviderModalServicePage } from '../provider-modal-service/provider-modal-service.page';
import { CoreService } from '../../../shared/services/core.service';
import { AuthService } from '../../../auth/services/auth.service';

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
export class ProviderAddServicePage implements OnInit {
  // Guard para evitar apertura múltiple del modal
  private isServiceModalOpen = false;

  // Inyectar servicios
  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private mapboxService = inject(MapboxService);
  private coreService = inject(CoreService);
  private authService = inject(AuthService);

  // Recibir datos del componente padre
  @Input() mainCategories: MainCategory[] = [];
  @Input() currentUser: any;
  @Input() providerData: any;

  servicioForm: FormGroup;

  // Variables para la selección
  selectedMainCategoryId: number = 0;
  categorias: ServiceCategory[] = [];
  activeCategory: MainCategory | null = null;
  selectedService: ServiceCategory | null = null;
  selectedServiceId: number = 0;

  // ── Disponibilidad (horarios por día) ──────────────────────────────────────
  timeOptions = TIME_OPTIONS;
  schedules: DaySchedule[] = [];

  // Variables para geolocalización
  isLoading: boolean = false;
  selectedAddressText: string = '';
  selectedAddressObject: any = null;
  address: any = { place: '', set: false };
  mapUrl: string = '';
  addressSuggestions: any[] = [];
  showAddressSuggestions: boolean = false;
  private searchTerms = new Subject<string>();
  isSearching: boolean = false;
  selectedAddress: string = '';

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
      nombre_prestador: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(45)]],
        fono: ['', [Validators.required, CustomValidators.phone()]],
      detalle: ['', [Validators.maxLength(100)]],
      direccion: ['', [Validators.required]],
      lat: ['', [Validators.required]],
      lng: ['', [Validators.required]]
    });
  }

  async ngOnInit() {
    console.log("add service init, currentUser:", this.currentUser);
    
    // Verificar autenticación
    if (!this.currentUser || typeof this.currentUser !== 'object' || !this.currentUser.id) {
      this.presentToast('Debe iniciar sesión para agregar servicios', 'danger');
      this.cancel();
      return;
    }

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
    await this.initMap(-33.4489, -70.6693); // Ubicación de Santiago
    
    // Si hay categorías, seleccionar la primera
    if (this.mainCategories && this.mainCategories.length > 0) {
      this.selectMainCategory(this.mainCategories[0]);
    }
  }

  // Seleccionar categoría principal
  selectMainCategory(category: MainCategory) {
    this.activeCategory = category;
    this.selectedMainCategoryId = category.id;
    this.servicioForm.patchValue({ servicio: category.id.toString() });
    this.loadSubcategories(category.id);
  }

// Cargar subcategorías
async loadSubcategories(mainCategoryId: number) {
    this.isLoading = true;
    
    if (this.coreService) {
      this.coreService.getMainCategoryWithServices(mainCategoryId).subscribe({
        next: (subcategories: ServiceCategory[]) => {
          this.categorias = subcategories || [];
          this.isLoading = false;
          
          // Si ya hay un servicio seleccionado, actualizarlo
          if (this.selectedServiceId) {
            const selectedService = this.categorias.find(s => s.id === this.selectedServiceId);
            if (selectedService) {
              this.selectedService = selectedService;
            }
          }
        },
        error: (error) => {
          console.error('Error loading subcategories:', error);
          this.categorias = [];
          this.isLoading = false;
          this.presentToast('Error al cargar servicios', 'danger');
        }
      });
    }
  }

// Método para depurar (puedes llamarlo desde el HTML o consola)
debugState() {
  console.log('=== DEBUG STATE ===');
  console.log('selectedService:', this.selectedService);
  console.log('selectedServiceId:', this.selectedServiceId);
  console.log('selectedMainCategoryId:', this.selectedMainCategoryId);
  console.log('activeCategory:', this.activeCategory);
  console.log('categorias:', this.categorias);
  console.log('servicioForm.categoria value:', this.servicioForm.get('categoria')?.value);
  console.log('servicioForm.valid:', this.servicioForm.valid);
  console.log('servicioForm.errors:', this.servicioForm.errors);
  console.log('=== END DEBUG ===');
}

  // Datos de prueba para subcategorías
  private getMockSubcategories(mainCategoryId: number): ServiceCategory[] {
    const mockServices: Record<number, ServiceCategory[]> = {
      1: [ // Hogar
        { id: 101, name: 'Electricista', description: 'Servicios eléctricos', main_category_id: 1, icon: 'flash', is_active: true, created_at: '' },
        { id: 102, name: 'Fontanería', description: 'Reparación de tuberías', main_category_id: 1, icon: 'water', is_active: true, created_at: '' },
        { id: 103, name: 'Carpintería', description: 'Trabajos en madera', main_category_id: 1, icon: 'construct', is_active: true, created_at: '' }
      ],
      2: [ // Belleza
        { id: 201, name: 'Peluquería', description: 'Cortes de cabello', main_category_id: 2, icon: 'cut', is_active: true, created_at: '' },
        { id: 202, name: 'Manicure', description: 'Cuidado de uñas', main_category_id: 2, icon: 'hand-left', is_active: true, created_at: '' },
        { id: 203, name: 'Maquillaje', description: 'Maquillaje profesional', main_category_id: 2, icon: 'color-palette', is_active: true, created_at: '' }
      ],
      3: [ // Salud
        { id: 301, name: 'Masajes', description: 'Terapia de masajes', main_category_id: 3, icon: 'body', is_active: true, created_at: '' },
        { id: 302, name: 'Fisioterapia', description: 'Rehabilitación física', main_category_id: 3, icon: 'fitness', is_active: true, created_at: '' }
      ]
    };
    
    return mockServices[mainCategoryId] || [];
  }

  // Seleccionar servicio
  selectService(service: ServiceCategory) {
    this.selectedService = service;
    this.selectedServiceId = service.id;
    this.servicioForm.patchValue({
      categoria: service.id.toString()
    });
  }

  // Abrir modal para seleccionar servicio
  async openServiceModal() {
    // Guard: evita crear múltiples instancias si el evento se dispara 2 veces
    if (this.isServiceModalOpen) return;
    this.isServiceModalOpen = true;

    const modal = await this.modalCtrl.create({
      component: ProviderModalServicePage,
      cssClass: 'fullscreen-modal',
      componentProps: {
        mainCategories: this.mainCategories,
        coreService: this.coreService,
        mapboxService: this.mapboxService,
        authService: this.authService,
        currentUser: this.currentUser
      }
    });
    
    modal.onDidDismiss().then(async (result) => {
      this.isServiceModalOpen = false;
      if (result.role === 'confirm' && result.data) {
        const selectedData = result.data;
        this.selectedMainCategoryId = parseInt(selectedData.servicio);
        this.selectedServiceId = parseInt(selectedData.categoria);
        
        // Buscar categoría principal
        const selectedCategory = this.mainCategories.find(c => c.id === this.selectedMainCategoryId);
        if (selectedCategory) {
          this.activeCategory = selectedCategory;
        }

         // Actualizar el formulario con los nuevos valores
      this.servicioForm.patchValue({
      servicio: this.selectedMainCategoryId.toString(),
      categoria: this.selectedServiceId.toString()
    }, { emitEvent: true });
      
        
        // Cargar subcategorías y luego buscar el servicio
       await  this.loadSubcategories(this.selectedMainCategoryId);
        setTimeout(() => {
          const selectedService = this.categorias.find(s => s.id === this.selectedServiceId);
          if (selectedService) {
            this.selectedService = selectedService;
          }
        }, 500);
      }
    });
    
    await modal.present();
  }

 

  // Limpiar selección de servicio
  clearServiceSelection() {
    this.servicioForm.patchValue({
      servicio: '',
      categoria: ''
    });
    this.selectedMainCategoryId = 0;
    this.selectedServiceId = 0;
    this.activeCategory = null;
    this.selectedService = null;
    this.categorias = [];
  }

  // Confirmar eliminación de servicio
  async onConfirmDelete() {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar servicio',
      message: '¿Está seguro de eliminar este servicio?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Eliminar', 
          handler: () => {
            this.clearServiceSelection();
          }
        }
      ]
    });
    
    await alert.present();
  }

  // Configurar autocompletado de direcciones
  private setupAutocomplete() {
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) {
          this.addressSuggestions = [];
          this.showAddressSuggestions = false;
          return [];
        }
        this.isSearching = true;
        return this.mapboxService.autocompleteChile(term);
      })
    ).subscribe({
      next: (suggestions: any[]) => {
        this.addressSuggestions = suggestions;
        this.showAddressSuggestions = suggestions.length > 0;
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Error en autocompletado:', error);
        this.addressSuggestions = [];
        this.showAddressSuggestions = false;
        this.isSearching = false;
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
    }
  }

  onAddressInput(event: any) {
    const query = event.target.value;
    this.selectedAddressText = query;
    this.selectedAddress = query;
    
    if (this.selectedAddressObject && query !== this.getSuggestionDisplayText(this.selectedAddressObject)) {
      this.selectedAddressObject = null;
      this.address.set = false;
      this.servicioForm.patchValue({
        lat: '',
        lng: ''
      });
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
    setTimeout(() => {
      if (this.selectedAddressObject && !this.selectedAddressText) {
        this.selectedAddressText = this.getSuggestionDisplayText(this.selectedAddressObject);
        this.selectedAddress = this.selectedAddressText;
      }
      this.showAddressSuggestions = false;
    }, 200);
  }

  selectAddressSuggestion(suggestion: any) {
    this.selectedAddressObject = suggestion;
    this.selectedAddressText = this.getSuggestionDisplayText(suggestion);
    this.selectedAddress = this.selectedAddressText;
    this.address.place = this.selectedAddressText;
    this.address.set = true;
    
    if (suggestion.center) {
      const [lng, lat] = suggestion.center;
      
      this.servicioForm.patchValue({
        direccion: this.selectedAddressText,
        lat: lat,
        lng: lng
      });
      
      this.updateMap(lat, lng);
    } else {
    // Si no hay coordenadas, al menos guarda la dirección
    this.servicioForm.patchValue({
      direccion: this.selectedAddressText
    });
  }
  
  // Forzar validación del formulario
  this.servicioForm.updateValueAndValidity();
    
    this.showAddressSuggestions = false;
    this.addressSuggestions = [];
  }

  clearAddress() {
    this.selectedAddressText = '';
    this.selectedAddress = '';
    this.selectedAddressObject = null;
    this.address.place = '';
    this.address.set = false;
    this.servicioForm.patchValue({
      direccion: '',
      lat: '',
      lng: ''
    });
  }

  // Métodos de utilidad
  getError(controlName: string): string {
    const control = this.servicioForm.get(controlName);
    return CustomValidators.getErrorMessage(control);
  }

  formatPhone(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.startsWith('56') && value.length === 11) {
      value = value.substring(2);
    }
    if (value.startsWith('9') && value.length === 9) {
      value = `+56 ${value.substring(0, 1)} ${value.substring(1, 5)} ${value.substring(5)}`;
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
  //       const formData = this.servicioForm.value;
  //       const fono = formData.fono.replace(/\s/g, '');

  //       const serviceData = {
  //         provider_id: this.currentUser.id,
  //         service_category_id: parseInt(formData.categoria),
  //         business_name: formData.nombre_prestador,
  //         description: formData.detalle || '',
  //         address: formData.direccion,
  //         latitude: parseFloat(formData.lat),
  //         longitude: parseFloat(formData.lng),
  //         phone: fono,
  //         hourly_rate: 15000, // Valor por defecto, debería ser un campo en el formulario
  //         is_available: true,
  //         validation_status: 'pending'
  //       };

  //       console.log('Datos del servicio a guardar:', serviceData);

  //       // Simular éxito de guardado
  //       setTimeout(async () => {
  //         await loading.dismiss();
  //         await this.presentToast('Servicio guardado correctamente', 'success');
          
  //         // Cerrar modal con éxito
  //         this.modalCtrl.dismiss({ 
  //           success: true, 
  //           service: serviceData 
  //         }, 'confirm');
  //       }, 2000);

  //     } catch (error: any) {
  //       await loading.dismiss();
  //       console.error('Error guardando servicio:', error);
        
  //       let errorMessage = 'No se pudo guardar el servicio';
  //       if (error.error?.detail) {
  //         errorMessage = error.error.detail;
  //       } else if (error.status === 404) {
  //         errorMessage = 'No se encontró el perfil de proveedor. Complete su registro primero.';
  //       } else if (error.status === 401) {
  //         errorMessage = 'Sesión expirada. Por favor inicie sesión nuevamente.';
  //       }
        
  //       this.presentToast(errorMessage, 'danger');
  //     }
  //   } else {
  //     // Marcar todos los campos como tocados para mostrar errores
  //     Object.keys(this.servicioForm.controls).forEach(key => {
  //       const control = this.servicioForm.get(key);
  //       if (control) {
  //         control.markAsTouched();
  //       }
  //     });
      
  //     let errorMessage = 'Por favor complete todos los campos requeridos';
  //     if (!this.selectedService) {
  //       errorMessage = 'Debe seleccionar un servicio';
  //     }
      
  //     this.presentToast(errorMessage, 'warning');
  //   }
  // }

   // Enviar servicio al backend
  async submitService() {
    if (this.servicioForm.valid && this.currentUser) {
      const loading = await this.loadingCtrl.create({
        message: 'Guardando servicio...'
      });
      await loading.present();

      try {
        const formData = this.servicioForm.value;
        const fono = formData.fono.replace(/\s/g, '');

        const serviceData = {
          servicio: parseInt(formData.servicio),
          categoria: parseInt(formData.categoria),
          nombre_prestador: formData.nombre_prestador,
          fono: fono,
          detalle: formData.detalle || '',
          direccion: formData.direccion,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          id_contacto: this.currentUser.id
        };

        console.log('Enviando datos al backend:', serviceData);

        if (this.coreService) {
          this.coreService.createServiceProvider(serviceData).subscribe({
            next: (response) => {
              this.saveSchedules(response).then(() => {
                loading.dismiss();
                this.presentToast('Servicio guardado correctamente', 'success');
                this.servicioForm.reset();
                this.modalCtrl.dismiss({ success: true, data: response }, 'confirm');
              });
            },
            error: async (error) => {
              loading.dismiss();
              console.error('Error guardando servicio:', error);

              if (error.status === 403) {
                await this.presentAlert(
                  'Verificación de identidad requerida',
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

  // Guardar horarios activos para el servicio recién creado
  private async saveSchedules(serviceResponse: any): Promise<void> {
    const spId: number = serviceResponse?.id;
    const providerId: number = serviceResponse?.provider_id;
    if (!spId || !providerId) return;

    const activeDays = this.schedules.filter(d => d.isActive);
    for (const day of activeDays) {
      try {
        await this.coreService.upsertServiceSchedule(providerId, spId, {
          service_id: spId,
          day_of_week: day.dayOfWeek,
          start_time: day.startTime,
          end_time: day.endTime,
          is_available: true,
        }).toPromise();
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