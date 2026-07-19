import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, LoadingController, AlertController, ActionSheetController } from '@ionic/angular';
import { ProviderService, ServiceProviderData } from '../../services/provider.service';
import { AuthService } from '../../../auth/services/auth.service';
import { CoreService } from '../../../shared/services/core.service';
import { MapboxService } from '../../../shared/services/mapbox.service';
import { CameraService } from '../../../shared/services/camera.service';
import { DocumentUploadService } from '../../../shared/services/document-upload.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CustomValidators } from '../../../shared/validators/custom-validators';
import { ContentFilterService } from '../../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../../shared/validators/content-filter.validators';

interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

interface PortfolioImage {
  file?: File;
  preview: string;
  url?: string;
  isExisting?: boolean;
}

const TIME_OPTIONS: string[] = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}:00`
);

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MAX_PORTFOLIO_IMAGES = 5;

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

  // Portfolio images
  readonly MAX_PORTFOLIO_IMAGES = MAX_PORTFOLIO_IMAGES;
  portfolioImages: PortfolioImage[] = [];
  uploadingImages: boolean = false;
  private actionSheetCtrl = inject(ActionSheetController);
  private cameraService = inject(CameraService);
  private documentUploadService = inject(DocumentUploadService);

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
  private readonly contentFilterService = inject(ContentFilterService);

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
          business_name: this.fb.control('', {
        validators: [Validators.required, Validators.minLength(5), Validators.maxLength(45)],
        asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'service')],
      }),
      description: this.fb.control('', {
        validators: [Validators.maxLength(100)],
        asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'service')],
      }),
      address: ['', [Validators.required]],
      latitude: ['', [Validators.required]],
      longitude: ['', [Validators.required]],
          phone: ['', [Validators.required, CustomValidators.phone()]],
    });
  }

  private setupAutocomplete() {
    this.searchTerms.pipe(
      debounceTime(600),
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

      // Cargar imágenes de portafolio existentes
      this.loadExistingPortfolioImages();

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

    this.servicioForm.patchValue({ phone: value });
  }

  private updateMap(lat: number, lng: number) {
    this.mapUrl = this.mapboxService.getStaticMapUrl(lat, lng, 14, 400, 200);
  }

  async updateService() {
    if (this.servicioForm.pending) {
      this.servicioForm.markAllAsTouched();
      await this.presentAlert('Validación', 'Validando contenido. Espera un momento e inténtalo otra vez.');
      return;
    }

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

      // ══ SUBIR NUEVAS IMÁGENES DE PORTAFOLIO ═══════════════════════════
      const existingUrls = this.portfolioImages
        .filter(img => img.isExisting && img.url)
        .map(img => img.url!);
      
      const newImages = this.portfolioImages.filter(img => !img.isExisting && img.file);
      let newUploadedUrls: string[] = [];

      if (newImages.length > 0) {
        loading.message = 'Subiendo imágenes...';
        try {
          newUploadedUrls = await this.uploadPortfolioImages(newImages);
        } catch (error) {
          console.error('Error subiendo imágenes:', error);
          await loading.dismiss();
          await this.presentAlert('Error', 'Error al subir imágenes. Intenta nuevamente.');
          this.isSaving = false;
          return;
        }
      }

      const allPortfolioUrls = [...existingUrls, ...newUploadedUrls];
      // ══════════════════════════════════════════════════════════════════

      loading.message = 'Actualizando servicio...';
      const formData = this.servicioForm.value;
      const serviceData: any = {
        business_name: formData.business_name,
        description: formData.description,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        phone: formData.phone
      };

      // ══ INCLUIR PORTFOLIO IMAGES ══════════════════════════════════════
      if (allPortfolioUrls.length > 0) {
        serviceData.portfolio_images = allPortfolioUrls;
      } else {
        serviceData.portfolio_images = [];
      }
      // ══════════════════════════════════════════════════════════════════

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

  // ══ PORTFOLIO IMAGES METHODS ══════════════════════════════════════════════════════════════════

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
      const file = this.base64ToFile(base64Data, 'portfolio-image.jpg');
      
      const validation = await this.documentUploadService.validateImage(file);
      
      if (!validation.valid) {
        await this.presentToast(validation.error || 'Imagen no válida', 'danger');
        return;
      }

      this.portfolioImages.push({
        file: file,
        preview: base64Data,
        isExisting: false
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
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Elimina una imagen del array
   */
  removeImage(index: number): void {
    if (index >= 0 && index < this.portfolioImages.length) {
      this.portfolioImages.splice(index, 1);
      this.presentToast('Imagen eliminada', 'success');
    }
  }

  /**
   * Sube las nuevas imágenes del portafolio a Cloudinary
   */
  private async uploadPortfolioImages(newImages: PortfolioImage[]): Promise<string[]> {
    if (newImages.length === 0) return [];

    this.uploadingImages = true;
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        
        if (!img.file) {
          console.warn(`Imagen ${i} no tiene file, saltando`);
          continue;
        }

        try {
          const signature = await this.documentUploadService.generateUploadSignature('portfolio').toPromise();
          
          if (!signature) {
            throw new Error('No se pudo generar firma de subida');
          }

          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('api_key', signature.api_key);
          formData.append('timestamp', signature.timestamp.toString());
          formData.append('signature', signature.signature);
          formData.append('folder', 'portfolio');

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

  /**
   * Carga imágenes existentes del servicio
   */
  private loadExistingPortfolioImages() {
    if (this.serviceData && (this.serviceData as any).portfolio_images) {
      const images = (this.serviceData as any).portfolio_images;
      
      if (Array.isArray(images)) {
        this.portfolioImages = images.map((img: any) => ({
          url: typeof img === 'string' ? img : img.url,
          preview: typeof img === 'string' ? img : img.url,
          isExisting: true
        }));
      }
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = document.createElement('ion-toast');
    toast.message = message;
    toast.duration = 2000;
    toast.color = color;
    toast.position = 'bottom';
    
    document.body.appendChild(toast);
    await toast.present();
    
    setTimeout(() => {
      toast.remove();
    }, 2100);
  }
}