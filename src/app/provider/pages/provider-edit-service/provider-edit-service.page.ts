import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { ProviderService, ServiceProviderData } from '../../services/provider.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CoreService } from '../../../shared/services/core.service';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CustomValidators } from '../../../shared/validators/custom-validators';

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

@Component({
  selector: 'app-provider-edit-service',
  templateUrl: './provider-edit-service.page.html',
  styleUrls: ['./provider-edit-service.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, ReactiveFormsModule]
})
export class ProviderEditServicePage implements OnInit {
  servicioForm!: FormGroup;

  currentUser: any;
  serviceId: number = 0;
  providerId: number = 0;

  isLoading: boolean = false;
  isSaving: boolean = false;
  serviceData: ServiceProviderData | null = null;

  // ── Disponibilidad ──────────────────────────────────────────────────────
  timeOptions = TIME_OPTIONS;
  schedules: DaySchedule[] = DAY_NAMES_ES.map((dayName, i) => ({
    dayOfWeek: i,
    dayName,
    isActive: i <= 4, // Lun–Vie activos por defecto
    startTime: i === 5 ? '08:00' : '08:00',
    endTime: i === 5 ? '14:00' : '20:00',
  }));

  // Variables para la dirección
  selectedAddressText: string = '';
  selectedAddressObject: any = null;
  mapUrl: string = '';
  addressSuggestions: any[] = [];
  showAddressSuggestions: boolean = false;
  private searchTerms = new Subject<string>();
  isSearching: boolean = false;
  serviceCategoryName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private providerService: ProviderService,
    private authService: AuthService,
    private coreService: CoreService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private fb: FormBuilder,
    private mapboxService: MapboxService
  ) { }

  async ngOnInit() {
    // Inicializar formulario inmediatamente
    this.servicioForm = this.createForm();
    
    this.currentUser = this.authService.getCurrentUser();
    console.log("Edit service provider:", this.currentUser);
    
    // Obtener parámetros de la ruta
    this.serviceId = parseInt(this.route.snapshot.paramMap.get('id') || '0');
    
    // Obtener providerId y serviceId de los query params
    this.route.queryParams.subscribe(params => {
      if (params['providerId']) {
        this.providerId = parseInt(params['providerId']);
      }
      if (params['serviceId']) {
        this.serviceId = parseInt(params['serviceId']);
      }
    });

    if (this.serviceId === 0) {
      this.presentAlert('Error', 'ID de servicio no válido');
      this.goBack();
      return;
    }

    // Si no hay providerId en los params, obtenerlo del usuario o del backend
    if (this.providerId === 0) {
      // Intentar obtener el provider_id del usuario actual
      const userProviderId = (this.currentUser as any)?.provider_id || (this.currentUser as any)?.id;
      if (userProviderId) {
        this.providerId = userProviderId;
      } else {
        // Si aún no tenemos providerId, intentar obtenerlo del backend
        await this.getProviderIdFromBackend();
      }
    }

    if (this.providerId === 0) {
      this.presentAlert('Error', 'No se pudo identificar el proveedor');
      this.goBack();
      return;
    }

    await this.loadServiceData();
    this.setupAutocomplete();
  }

  private async getProviderIdFromBackend() {
    try {
      // Intentar obtener el perfil del proveedor
      const profile = await this.providerService.getProviderProfile(
        this.currentUser?.id?.toString() || ''
      ).toPromise().then(data => data || null);
      
      if (profile) {
        this.providerId = profile.id;
        console.log('Provider ID obtenido del backend:', this.providerId);
      }
    } catch (error) {
      console.error('Error obteniendo provider ID del backend:', error);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
          business_name: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(45)]],
      description: ['', [Validators.maxLength(100)]],
      address: ['', [Validators.required]],
      latitude: ['', [Validators.required]],
      longitude: ['', [Validators.required]],
          phone: ['', [Validators.required, CustomValidators.phone()]],
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

  private async loadServiceData() {
    const loading = await this.loadingCtrl.create({
      message: 'Cargando servicio...'
    });
    await loading.present();

    try {
      this.isLoading = true;
      
      // Verificar que tenemos el provider_id
      if (this.providerId === 0) {
        this.presentAlert('Error', 'No se pudo identificar el proveedor');
        await loading.dismiss();
        this.router.navigate(['/provider/tabs']);
        return;
      }
      
      console.log('Obteniendo servicio con providerId:', this.providerId, 'serviceId:', this.serviceId);
      
      this.serviceData = await this.providerService.getProviderServiceById(
        this.providerId, 
        this.serviceId
      ).toPromise().then(data => data || null);

      if (!this.serviceData) {
        this.presentAlert('Error', 'No se encontró la información del servicio');
        await loading.dismiss();
        this.router.navigate(['/provider/tabs']);
        return;
      }

      // Obtener nombre de categoría
      this.serviceCategoryName = this.serviceData.service_category?.name || 'Categoría no disponible';

      // Configurar dirección
      this.selectedAddressText = this.serviceData.address || '';
      
      // Cargar datos en el formulario
      this.servicioForm.patchValue({
        business_name: this.serviceData.business_name || '',
        description: this.serviceData.description || '',
        address: this.serviceData.address || '',
        latitude: this.serviceData.latitude?.toString() || '',
        longitude: this.serviceData.longitude?.toString() || '',
        phone: this.serviceData.phone || ''
      });

      // Actualizar mapa
      if (this.serviceData.latitude && this.serviceData.longitude) {
        this.updateMap(this.serviceData.latitude, this.serviceData.longitude);
      }

      // Marcar campos como tocados para que se muestren errores si hay
      this.servicioForm.markAllAsTouched();

      // Cargar horarios existentes del servicio
      this.loadExistingSchedules();

    } catch (error: any) {
      console.error('Error cargando servicio:', error);
      await this.presentAlert('Error', 'No se pudo cargar el servicio');
      this.goBack();
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  private loadExistingSchedules() {
    if (!this.providerId || !this.serviceId) return;
    this.coreService.getServiceSchedules(this.providerId, this.serviceId).subscribe({
      next: (serverSchedules) => {
        if (!serverSchedules || serverSchedules.length === 0) return; // mantener defaults
        // Reset primero para no mezclar defaults con datos del servidor
        this.schedules.forEach(d => { d.isActive = false; });
        serverSchedules.forEach(ss => {
          const day = this.schedules.find(d => d.dayOfWeek === ss.day_of_week);
          if (day) {
            day.isActive = ss.is_available;
            day.startTime = ss.start_time.substring(0, 5);
            day.endTime = ss.end_time.substring(0, 5);
          }
        });
      },
      error: () => {} // sin horarios configurados aún, se queda en defaults
    });
  }

  private async saveSchedules(): Promise<void> {
    if (!this.providerId || !this.serviceId) return;
    for (const day of this.schedules) {
      if (!day.isActive) continue;
      try {
        await this.coreService.upsertServiceSchedule(this.providerId, this.serviceId, {
          service_id: this.serviceId,
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

  goBack() {
    this.router.navigate(['/provider/tabs']);
  }

  onAddressFocus() {
    if (this.addressSuggestions.length > 0) {
      this.showAddressSuggestions = true;
    }
  }

  formatPhone(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    
    // Si tiene 11 dígitos y empieza con 56 (formato chileno sin +)
    if (value.startsWith('56') && value.length === 11) {
      value = value.substring(2); // Quitar el 56
    }
    
    // Formatear a +56 9 XXXX XXXX
    if (value.startsWith('9') && value.length === 9) {
      value = `+56 ${value.substring(0, 1)} ${value.substring(1, 5)} ${value.substring(5)}`;
    }
    
    this.servicioForm.patchValue({ phone: value });
  }

  private updateMap(lat: number, lng: number) {
    this.mapUrl = this.mapboxService.getStaticMapUrl(lat, lng, 14, 400, 200);
  }

  async updateService() {
    // Validar formulario
    if (this.servicioForm.invalid) {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(this.servicioForm.controls).forEach(key => {
        const control = this.servicioForm.get(key);
        control?.markAsTouched();
      });
      this.presentAlert('Validación', 'Por favor, complete todos los campos requeridos correctamente');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Actualizando servicio...'
    });
    await loading.present();

    try {
      this.isSaving = true;

      const formData = this.servicioForm.value;
      const serviceData = {
        business_name: formData.business_name,
        description: formData.description,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        phone: formData.phone
        // Agrega otros campos si son necesarios para tu API
      };

      console.log('Datos a actualizar:', serviceData);

      // Llamar al servicio para actualizar
      await this.providerService.updateProviderService(
        this.providerId,
        this.serviceId,
        serviceData
      ).toPromise();

      await this.saveSchedules();

      await loading.dismiss();
      await this.presentAlert('Éxito', 'Servicio actualizado correctamente');
      
      // Navegar de vuelta a service-details con query param para forzar recarga
      this.router.navigate(['/provider/tabs'], {
        queryParams: { refresh: true }
      });

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error actualizando servicio:', error);
      await this.presentAlert('Error', error.message || 'No se pudo actualizar el servicio');
    } finally {
      this.isSaving = false;
    }
  }

  onAddressInput(event: any) {
    const query = event.target.value;
    this.selectedAddressText = query;
    
    if (this.selectedAddressObject && query !== this.getSuggestionDisplayText(this.selectedAddressObject)) {
      this.selectedAddressObject = null;
      this.servicioForm.patchValue({
        latitude: '',
        longitude: ''
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
      this.showAddressSuggestions = false;
    }, 200);
  }

  selectAddressSuggestion(suggestion: any) {
    this.selectedAddressObject = suggestion;
    this.selectedAddressText = this.getSuggestionDisplayText(suggestion);
    
    // Actualizar el formulario con la dirección seleccionada
    this.servicioForm.patchValue({
      address: this.selectedAddressText
    });
    
    if (suggestion.center) {
      const [lng, lat] = suggestion.center;
      
      // Actualizar coordenadas en el formulario
      this.servicioForm.patchValue({
        latitude: lat.toString(),
        longitude: lng.toString()
      });
      
      // Actualizar mapa
      this.updateMap(lat, lng);
    }
    
    // Forzar validación del formulario
    this.servicioForm.updateValueAndValidity();
    
    this.showAddressSuggestions = false;
    this.addressSuggestions = [];
  }

  getSuggestionDisplayText(suggestion: any): string {
    if (suggestion.place_name) {
      return suggestion.place_name;
    }
    if (suggestion.text) {
      return suggestion.text;
    }
    return 'Dirección desconocida';
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
    if (types.includes('address')) return 'success';
    if (types.includes('place')) return 'primary';
    if (types.includes('poi')) return 'secondary';
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

  getError(controlName: string): string {
    const control = this.servicioForm.get(controlName);
    return CustomValidators.getErrorMessage(control);
  }

  clearAddress() {
    this.selectedAddressText = '';
    this.selectedAddressObject = null;
    this.servicioForm.patchValue({
      address: '',
      latitude: '',
      longitude: ''
    });
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}