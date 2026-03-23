import { Injectable, signal, computed } from '@angular/core';

export interface SelectedService {
  id: number;
  name: string;
  description?: string;
  main_category_id: number;
  mainCategoryName: string;
}

export interface SelectedProvider {
  id: number;
  name: string;
  avatar?: string;
  rating?: number;
  distance?: number;
  lat?: number;
  lng?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SelectionService {

  // Signals para estado reactivo
  private _selectedServices = signal<SelectedService[]>([]);
  private _selectedProvider = signal<SelectedProvider | null>(null);
  private _selectedCategoryId = signal<number | null>(null);
  private _selectedDate = signal<Date | null>(null);
  private _selectedTime = signal<string | null>(null);

  // Computed values públicos (readonly)
  public readonly selectedServices = this._selectedServices.asReadonly();
  public readonly selectedProvider = this._selectedProvider.asReadonly();
  public readonly selectedCategoryId = this._selectedCategoryId.asReadonly();
  public readonly selectedDate = this._selectedDate.asReadonly();
  public readonly selectedTime = this._selectedTime.asReadonly();

  // Computed para total


  public readonly hasSelection = computed(() => 
    this._selectedServices().length > 0
  );

  constructor() {
    // console.log('SelectionService initialized');
  }

  // ==================== SERVICIOS ====================

  addService(service: SelectedService): void {
    const current = this._selectedServices();
    if (!current.find(s => s.id === service.id)) {
      this._selectedServices.set([...current, service]);
    }
  }

  removeService(serviceId: number): void {
    const current = this._selectedServices();
    this._selectedServices.set(current.filter(s => s.id !== serviceId));
  }

  toggleService(service: SelectedService): void {
    const current = this._selectedServices();
    const exists = current.find(s => s.id === service.id);
    if (exists) {
      this.removeService(service.id);
    } else {
      this.addService(service);
    }
  }

  isServiceSelected(serviceId: number): boolean {
    return this._selectedServices().some(s => s.id === serviceId);
  }

  clearSelectedServices(): void {
    this._selectedServices.set([]);
  }

  getSelectedServiceIds(): number[] {
    return this._selectedServices().map(s => s.id);
  }

  // ==================== PROVEEDOR ====================

  setProvider(provider: SelectedProvider): void {
    this._selectedProvider.set(provider);
  }

  clearProvider(): void {
    this._selectedProvider.set(null);
  }

  // ==================== CATEGORÍA ====================

  setCategoryId(categoryId: number): void {
    this._selectedCategoryId.set(categoryId);
  }

  clearCategoryId(): void {
    this._selectedCategoryId.set(null);
  }

  // ==================== FECHA Y HORA ====================

  setDate(date: Date): void {
    this._selectedDate.set(date);
  }

  setTime(time: string): void {
    this._selectedTime.set(time);
  }

  clearDateTime(): void {
    this._selectedDate.set(null);
    this._selectedTime.set(null);
  }

  // ==================== RESET COMPLETO ====================

  clearAll(): void {
    this._selectedServices.set([]);
    this._selectedProvider.set(null);
    this._selectedCategoryId.set(null);
    this._selectedDate.set(null);
    this._selectedTime.set(null);
  }

  // ==================== GETTERS PARA COMPATIBILIDAD ====================

  getSelectedServices(): SelectedService[] {
    return this._selectedServices();
  }

  getSelectedProvider(): SelectedProvider | null {
    return this._selectedProvider();
  }

  getSelectedCategoryId(): number | null {
    return this._selectedCategoryId();
  }
}
