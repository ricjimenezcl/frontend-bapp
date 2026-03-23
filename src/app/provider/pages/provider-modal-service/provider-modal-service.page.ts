import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, CUSTOM_ELEMENTS_SCHEMA  } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ModalController, IonicSlides } from '@ionic/angular';
import { CoreService } from '../../../shared/services/core.service';

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
  selector: 'app-provider-modal-service',
  templateUrl: './provider-modal-service.page.html',
  styleUrls: ['./provider-modal-service.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule
  ]
})
export class ProviderModalServicePage implements OnInit {
  swiperModules = [IonicSlides];
  // Recibir categorías principales del componente padre
  @Input() mainCategories: MainCategory[] = [];
  
  // Recibir servicio para cargar subcategorías
  @Input() coreService!: CoreService;
  
  // Variables para la selección
  selectedMainCategory: MainCategory | null = null;
  selectedService: ServiceCategory | null = null;
  
  // Subcategorías (servicios) de la categoría seleccionada
  subcategories: ServiceCategory[] = [];
  
  // Estado de carga
  isLoading: boolean = false;

  // Guard: evita dismiss doble si se toca el botón varias veces
  private isDismissing = false;

  constructor(private modalController: ModalController) { }

  ngOnInit() {
    console.log('Modal inicializado con categorías:', this.mainCategories);
    
    // Seleccionar la primera categoría por defecto si hay categorías
    if (this.mainCategories.length > 0) {
      this.selectMainCategory(this.mainCategories[0]);
    }
  }

  // Seleccionar categoría principal y cargar sus servicios
  async selectMainCategory(category: MainCategory) {
    this.selectedMainCategory = category;
    this.selectedService = null; // Resetear servicio seleccionado
    this.subcategories = []; // Limpiar servicios anteriores
    
    if (this.coreService) {
      this.isLoading = true;
      try {
        // Cargar subcategorías de esta categoría principal
        this.coreService.getMainCategoryWithServices(category.id).subscribe({
          next: (subcategories: ServiceCategory[]) => {
            this.subcategories = subcategories || [];
            this.isLoading = false;
            console.log(`Subcategorías cargadas para ${category.name}:`, this.subcategories);
          },
          error: (error) => {
            console.error('Error cargando subcategorías:', error);
            this.subcategories = [];
            this.isLoading = false;
          }
        });
      } catch (error) {
        console.error('Error en selectMainCategory:', error);
        this.isLoading = false;
      }
    }
  }

  // Seleccionar un servicio específico
  selectService(service: ServiceCategory) {
    this.selectedService = service;
    console.log('Servicio seleccionado:', service);
  }

  // Confirmar la selección y cerrar el modal
  confirmSelection() {
    if (this.isDismissing) return;
    if (this.selectedMainCategory && this.selectedService) {
      this.isDismissing = true;
      const selectedData = {
        servicio: this.selectedMainCategory.id.toString(), // main_category_id
        categoria: this.selectedService.id.toString(), // service_category_id
        servicioNombre: this.selectedMainCategory.name,
        categoriaNombre: this.selectedService.name
      };
      
      console.log('Datos seleccionados para enviar:', selectedData);
      
      // Cerrar el modal con los datos seleccionados
      this.modalController.dismiss(selectedData, 'confirm');
  
    }
  }

    onSalonList(name: any) {
    console.log("Servicio : ", name);
    // const param: NavigationExtras = {
    //   queryParams: {
    //     name: name
    //   }
    // };
    // this.util.navigateToPage('salon-list', param);
  }

  // Método para obtener icono según el nombre de la categoría
getCategoryIcon(categoryName: string): string {
  const iconMap: {[key: string]: string} = {
    'construcción': 'hammer',
    'fontanería': 'water',
    'electricidad': 'flash',
    'carpintería': 'construct',
    'jardinería': 'leaf',
    'limpieza': 'sparkles',
    'mascotas': 'paw',
    'reparaciones': 'build',
    'belleza': 'cut',
    'salud': 'medkit',
    'educación': 'school',
    'transporte': 'car',
    'eventos': 'calendar',
    'tecnología': 'laptop',
    'alimentos': 'restaurant',
    'belleza y estética': 'cut',
    'salud y bienestar': 'medkit',
    'hogar y jardín': 'home',
    'educación y tutoría': 'school',
    'automotriz': 'car-sport',
    'eventos y catering': 'restaurant',
    'tecnología y reparaciones': 'laptop'
  };
  
  const lowerName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  
  return 'build'; // Icono por defecto
}

  // Cancelar y cerrar el modal
  cancel() {
    if (this.isDismissing) return;
    this.isDismissing = true;
    this.modalController.dismiss(null, 'cancel');
  }

  
}