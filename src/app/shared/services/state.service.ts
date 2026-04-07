import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

// Interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  rut?: string;
  role: 'client' | 'provider';
  profileImage?: string;
}

// export interface SelectedService {
//   id: string;
//   name: string;
//   category: string;
//   price?: number;
// }

export interface SelectedService {
  id: number;
  name: string;
  description?: string;
  main_category_id: number;
  mainCategoryName: string;
}


export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: number;
}

export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export interface AppState {
  user: User | null;
  token: string | null;
  selectedServices: SelectedService[];
  userLocation: UserLocation | null;
  loading: boolean;
  error: AppError | null;
}

export interface AlternateLocation {
  latitude: number;
  longitude: number;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly STORAGE_KEY = 'app-state';
  // Session-only (not persisted)
  private alternateLocationSubject = new BehaviorSubject<AlternateLocation | null>(null);
  alternateLocation$ = this.alternateLocationSubject.asObservable();
  
  private initialState: AppState = {
    user: null,
    token: null,
    selectedServices: [],
    userLocation: null,
    loading: false,
    error: null
  };

  private stateSubject = new BehaviorSubject<AppState>(this.loadState());
  state$ = this.stateSubject.asObservable();

  // Selectores
  user$ = this.state$.pipe(map(state => state.user));
  token$ = this.state$.pipe(map(state => state.token));
  selectedServices$ = this.state$.pipe(map(state => state.selectedServices));
  userLocation$ = this.state$.pipe(map(state => state.userLocation));
  loading$ = this.state$.pipe(map(state => state.loading));
  error$ = this.state$.pipe(map(state => state.error));

  constructor() {
    // Persistir cambios automáticamente
    this.state$.subscribe(state => this.saveState(state));
  }

  // Getters síncronos
  getUser(): User | null {
    return this.stateSubject.value.user;
  }

  getToken(): string | null {
    return this.stateSubject.value.token;
  }

  getSelectedServices(): SelectedService[] {
    return this.stateSubject.value.selectedServices;
  }

  getUserLocation(): UserLocation | null {
    return this.stateSubject.value.userLocation;
  }

  // Setters
  setUser(user: User | null): void {
    this.updateState({ user });
  }

  setToken(token: string | null): void {
    this.updateState({ token });
  }

  setSelectedServices(services: SelectedService[]): void {
    this.updateState({ selectedServices: services });
  }

  addService(service: SelectedService): void {
    const current = this.stateSubject.value.selectedServices;
    const updated = [...current, service];
    this.updateState({ selectedServices: updated });
  }

  removeService(serviceId: number): void {
    const current = this.stateSubject.value.selectedServices;
    const updated = current.filter(s => s.id !== serviceId);
    this.updateState({ selectedServices: updated });
  }

  setUserLocation(location: UserLocation | null): void {
    this.updateState({ userLocation: location });
  }

  setAlternateLocation(location: AlternateLocation | null): void {
    this.alternateLocationSubject.next(location);
  }

  getAlternateLocation(): AlternateLocation | null {
    return this.alternateLocationSubject.value;
  }

  setLoading(loading: boolean): void {
    this.updateState({ loading });
  }

  setError(error: AppError | null): void {
    this.updateState({ error });
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  // Limpiar estado (logout)
  clearState(): void {
    this.stateSubject.next(this.initialState);
  }

  private updateState(partial: Partial<AppState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...partial });
  }

  private loadState(): AppState {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      const base = saved ? { ...this.initialState, ...JSON.parse(saved) } : { ...this.initialState };

      // ✅ CORRECCIÓN MOBILE: sincronizar token desde AuthService si StateService no lo tiene.
      // AuthService guarda el token en 'token', StateService en 'app-state'.
      // Si hay token en 'token' pero no en 'app-state', cargar el de AuthService.
      if (!base.token) {
        const authToken = localStorage.getItem('token');
        if (authToken) {
          base.token = authToken;
        }
      }

      return base;
    } catch (error) {
      console.error('Error loading state from localStorage:', error);
    }
    return this.initialState;
  }

  private saveState(state: AppState): void {
    try {
      // No guardar loading ni error para mantener el estado persistido limpio
      const persistedState: Partial<AppState> = {
        user: state.user,
        token: state.token,
        selectedServices: state.selectedServices,
        userLocation: state.userLocation
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(persistedState));
    } catch (error) {
      console.error('Error saving state to localStorage:', error);
    }
  }
}
