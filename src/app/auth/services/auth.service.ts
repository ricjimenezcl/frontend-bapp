// auth.service.ts (versión corregida)
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SocialUser } from '@abacritt/angularx-social-login';
import { ProviderService, ProviderProfile, ServiceProviderData } from '../../provider/services/provider.service';
import { ProfileCompletionService } from '../../core/services/profile-completion.service';

// Interfaces exportadas
export interface User {
  id: string | number;
  email: string;
  role: string;
  access_token: string;
  user_id?: string | number;
  provider_id?: string | number;
  client_id?: string | number;
  name?: string;
  picture?: string;
  verified?: boolean;
  status?: string;
  token?: string; // Alias para compatibilidad
  terms_accepted?: boolean;
  is_new_user?: boolean;
}

export interface UserProfile extends User {
  // Datos extendidos del perfil de proveedor
  id_contacto?: number;
  full_name: string;
  phone: string;
  run?: string;
  bio?: string;
  avatar?: string | null;
  rating_avg?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  
  // Subject para datos básicos del usuario
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  // Subject para datos completos del perfil
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();
  
  // Subject para servicios del proveedor
  private providerServicesSubject = new BehaviorSubject<ServiceProviderData[]>([]);
  public providerServices$ = this.providerServicesSubject.asObservable();
  
  // Subject para estado de carga
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private profileCompletion: ProfileCompletionService
  ) {
    this.loadUserFromStorage();
  }

  /**
   * Carga los datos del usuario desde localStorage al iniciar
   */
  private loadUserFromStorage(): void {
    console.log('Cargando datos desde localStorage...');
    
    // Cargar datos básicos del usuario
    const userData = localStorage.getItem('user_data');
    const token = localStorage.getItem('token');
    
    if (userData && token) {
      try {
        const user = JSON.parse(userData) as User;
        const userWithToken: User = {
          ...user,
          token: token,
          access_token: token // Mantener compatibilidad
        };
        this.currentUserSubject.next(userWithToken);
        console.log('Usuario cargado desde localStorage:', userWithToken);
      } catch (error) {
        console.error('Error parseando user_data:', error);
        this.clearLocalStorage();
      }
    }
    
    // Cargar perfil completo
    const profileData = localStorage.getItem('user_profile');
    if (profileData) {
      try {
        const profile = JSON.parse(profileData) as UserProfile;
        this.userProfileSubject.next(profile);
        console.log('Perfil cargado desde localStorage:', profile);
      } catch (error) {
        console.error('Error parseando user_profile:', error);
        localStorage.removeItem('user_profile');
      }
    }
    
    // Cargar servicios del proveedor
    const servicesData = localStorage.getItem('provider_services');
    if (servicesData) {
      try {
        const services = JSON.parse(servicesData) as ServiceProviderData[];
        this.providerServicesSubject.next(services);
        console.log('Servicios cargados desde localStorage:', services.length, 'servicios');
      } catch (error) {
        console.error('Error parseando provider_services:', error);
        localStorage.removeItem('provider_services');
      }
    }
  }

  /**
   * Establece los datos del usuario (login)
   */
  setUser(user: User, token?: string): void {
    if (!user) {
      console.error('Intento de establecer usuario null');
      return;
    }

    const userWithToken: User = {
      ...user,
      token: token || user.token || user.access_token,
      access_token: token || user.access_token || user.token || ''
    };

    console.log('Estableciendo usuario:', userWithToken);
    
    localStorage.setItem('user_data', JSON.stringify(userWithToken));
    
    if (token) {
      localStorage.setItem('token', token);
    } else if (userWithToken.token) {
      localStorage.setItem('token', userWithToken.token);
    }
    
    this.currentUserSubject.next(userWithToken);
  }

  /**
   * Establece los datos completos del perfil
   */
  setUserProfile(profile: Partial<UserProfile>): UserProfile {
    if (!profile) {
      console.error('Intento de establecer perfil null');
      throw new Error('Perfil no puede ser null');
    }

    // Combinar con usuario actual
    const currentUser = this.getCurrentUser();
    
    // Asegurar valores requeridos
    const updatedProfile: UserProfile = {
      id: profile.id || currentUser?.id || 0,
      email: profile.email || currentUser?.email || '',
      role: profile.role || currentUser?.role || '',
      access_token: currentUser?.access_token || currentUser?.token || '',
      user_id: profile.user_id || currentUser?.user_id,
      provider_id: profile.provider_id || currentUser?.provider_id,
      client_id: profile.client_id || currentUser?.client_id,
      name: profile.name || currentUser?.name,
      picture: profile.picture || currentUser?.picture,
      verified: profile.verified || currentUser?.verified,
      token: currentUser?.token || currentUser?.access_token,
      
      // Campos específicos de UserProfile
      id_contacto: profile.id_contacto ? Number(profile.id_contacto) : 
                  currentUser?.provider_id ? Number(currentUser.provider_id) : 
                  currentUser?.id ? Number(currentUser.id) : undefined,
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      run: profile.run,
      bio: profile.bio,
      avatar: profile.avatar,
      rating_avg: profile.rating_avg,
      status: profile.status,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };

    console.log('Estableciendo perfil completo:', updatedProfile);
    
    localStorage.setItem('user_profile', JSON.stringify(updatedProfile));
    this.userProfileSubject.next(updatedProfile);
    
    return updatedProfile;
  }

  /**
   * Obtiene el perfil completo del usuario desde la API y lo almacena
   */
  fetchUserProfileFromApi(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/me`).pipe(
      tap((response: any) => {
        if (response?.profile) {
          this.setUserProfile({
            full_name: response.profile.full_name || '',
            phone: response.profile.phone || '',
            avatar: response.profile.avatar,
            bio: response.profile.bio
          });
        }
      })
    );
  }

  /**
   * Establece los servicios del proveedor
   */
  setProviderServices(services: ServiceProviderData[]): void {
    console.log('Estableciendo servicios:', services.length, 'servicios');
    
    localStorage.setItem('provider_services', JSON.stringify(services));
    this.providerServicesSubject.next(services);
  }

  /**
   * Carga datos completos del proveedor (perfil + servicios)
   */
  loadCompleteProviderData(providerService: ProviderService): Observable<{ profile: ProviderProfile; services: ServiceProviderData[] }> {
    this.isLoadingSubject.next(true);
    
    const currentUser = this.getCurrentUser();
    const providerId = currentUser?.provider_id || currentUser?.id;
    
    console.log('Cargando datos completos para proveedor ID:', providerId);
    
    if (!providerId) {
      this.isLoadingSubject.next(false);
      throw new Error('Usuario no autenticado o sin ID de proveedor');
    }
    
    return forkJoin({
      profile: providerService.getProviderProfile(providerId.toString()),
      services: providerService.getProviderServices(providerId.toString())
    }).pipe(
      map((result) => ({
        profile: result.profile,
        services: result.services as unknown as ServiceProviderData[]
      })),
      tap({
        next: (results) => {
          console.log('Datos completos recibidos del backend:', {
            profile: results.profile,
            servicios: results.services.length
          });
          
          // Crear perfil completo
          const userProfile: Partial<UserProfile> = {
            ...currentUser,
            ...results.profile,
            id_contacto: Number(providerId),
            token: currentUser?.token || currentUser?.access_token,
            access_token: currentUser?.access_token || currentUser?.token || ''
          };
          
          // Guardar en estado
          this.setUserProfile(userProfile);
          this.setProviderServices(results.services as ServiceProviderData[]);
          this.isLoadingSubject.next(false);
          
          console.log('Datos completos guardados exitosamente');
        },
        error: (error) => {
          console.error('Error en loadCompleteProviderData:', error);
          this.isLoadingSubject.next(false);
        }
      }),
      catchError((error) => {
        this.isLoadingSubject.next(false);
        throw error;
      })
    );
  }

  /**
   * Obtiene el usuario actual (sincrónico)
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Obtiene el perfil completo del usuario (sincrónico)
   */
  getUserProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }

  /**
   * Obtiene los servicios del proveedor (sincrónico)
   */
  getProviderServices(): ServiceProviderData[] {
    return this.providerServicesSubject.value;
  }

  /**
   * Verifica si hay datos del perfil cargados
   */
  hasProfileData(): boolean {
    return this.userProfileSubject.value !== null;
  }

  /**
   * Verifica si hay servicios cargados
   */
  hasServicesData(): boolean {
    return this.providerServicesSubject.value.length > 0;
  }

  /**
   * Verifica si todos los datos están cargados
   */
  hasCompleteData(): boolean {
    return this.hasProfileData() && this.hasServicesData();
  }

  /**
   * Observables para suscribirse a cambios
   */
  getCurrentUserObservable(): Observable<User | null> {
    return this.currentUser$;
  }

  getUserProfileObservable(): Observable<UserProfile | null> {
    return this.userProfile$;
  }

  getProviderServicesObservable(): Observable<ServiceProviderData[]> {
    return this.providerServices$;
  }

  getIsLoadingObservable(): Observable<boolean> {
    return this.isLoading$;
  }

  /**
   * Limpia todos los datos (excepto datos básicos de autenticación)
   */
  clearProfileData(): void {
    console.log('Limpiando datos de perfil y servicios...');
    
    localStorage.removeItem('user_profile');
    localStorage.removeItem('provider_services');
    this.userProfileSubject.next(null);
    this.providerServicesSubject.next([]);
  }

  /**
   * Limpia todos los datos incluyendo autenticación
   */
  clearAllData(): void {
    console.log('Limpiando todos los datos...');
    this.clearLocalStorage();
    this.currentUserSubject.next(null);
    this.userProfileSubject.next(null);
    this.providerServicesSubject.next([]);
    this.isLoadingSubject.next(false);
  }

  /**
   * Limpia localStorage
   */
  private clearLocalStorage(): void {
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('provider_services');
    localStorage.removeItem('token');

    
  }

  /**
   * Métodos de autenticación existentes
   */

  loginClient(credentials: { email: string, password: string }): Observable<any> {
    // Enviar como JSON en lugar de URLSearchParams
    const body = {
      username: credentials.email,
      password: credentials.password
    };

    return this.http.post(`${this.apiUrl}/auth/login`, body).pipe(
      tap((response: any) => {
        console.log('Login exitoso:', response);
        localStorage.setItem('token', response.access_token);
        
        let tempUser: User;
      
        if (response.role === "PROVIDER") {
          tempUser = {
            id: response.provider_id || response.user_id,
            email: response.email,
            role: response.role,
            access_token: response.access_token,
            user_id: response.user_id,
            provider_id: response.provider_id
          };
        } else if (response.role === "CLIENT") {
          tempUser = {
            id: response.user_id,
            email: response.email,
            role: response.role,
            access_token: response.access_token,
            user_id: response.user_id,
            client_id: response.client_id
          };
        } else {
          tempUser = {
            id: response.user_id,
            email: response.email,
            role: response.role,
            access_token: response.access_token,
            user_id: response.user_id
          };
        }
        
        this.setUser(tempUser, response.access_token);
      }),
      catchError((error) => {
        console.error('Error en login:', error);
        throw error;
      })
    );
  }

  loginWithGoogle(idToken: string, role: string = 'CLIENT'): Observable<any> {
    console.log('Enviando token Google al backend:', idToken?.substring(0, 50) + '...');

    // Backend espera: { id_token: string, role: string }
    // Backend retorna: { access_token, user_id, role, provider_id, client_id, email, name, avatar_url, terms_accepted }
    return this.http.post(`${this.apiUrl}/auth/oauth/google`, { id_token: idToken, role }).pipe(
      tap((response: any) => {
        console.log('Respuesta del backend Google:', response);

        localStorage.setItem('token', response.access_token);

        const googleUser: User = {
          id: response.user_id,
          email: response.email,
          role: response.role || 'CLIENT',
          access_token: response.access_token,
          user_id: response.user_id,
          provider_id: response.provider_id,
          client_id: response.client_id,
          name: response.name,
          picture: response.avatar_url,
          terms_accepted: response.terms_accepted,
          is_new_user: response.is_new_user,
        };

        this.setUser(googleUser, response.access_token);
      }),
      catchError((error) => {
        console.error('Error completo en loginWithGoogle:', error);
        throw error;
      })
    );
  }

  loginWithFacebook(accessToken: string, role: string = 'CLIENT'): Observable<any> {
    // Backend espera: { access_token: string, role: string }
    // Backend retorna: { access_token, user_id, role, provider_id, client_id, email, name, avatar_url, terms_accepted }
    return this.http.post(`${this.apiUrl}/auth/oauth/facebook`, { access_token: accessToken, role }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.access_token);
        const facebookUser: User = {
          id: response.user_id,
          email: response.email,
          role: response.role || 'CLIENT',
          access_token: response.access_token,
          user_id: response.user_id,
          provider_id: response.provider_id,
          client_id: response.client_id,
          name: response.name,
          picture: response.avatar_url,
          terms_accepted: response.terms_accepted,
          is_new_user: response.is_new_user,
        };
        this.setUser(facebookUser, response.access_token);
      }),
      catchError((error) => {
        console.error('Error en loginWithFacebook:', error);
        throw error;
      })
    );
  }

  acceptTerms(emailOptIn: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/auth/accept-terms`, { email_opt_in: emailOptIn }).pipe(
      tap(() => {
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          const updated: User = { ...currentUser, terms_accepted: true };
          this.setUser(updated);
        }
      }),
      catchError((error) => {
        console.error('Error en acceptTerms:', error);
        throw error;
      })
    );
  }

  handleGoogleSocialUser(socialUser: SocialUser): Observable<any> {
    if (!socialUser || !socialUser.idToken) {
      throw new Error('Usuario de Google no válido');
    }
    
    return this.loginWithGoogle(socialUser.idToken);
  }

  logout(): void {
    console.log('Ejecutando logout...');
    this.profileCompletion.reset();
    this.clearAllData();
  }

  isAuthenticated(): boolean {
    const hasToken = !!localStorage.getItem('token');
    const hasUser = !!this.currentUserSubject.value;
    return hasToken && hasUser;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Verifica si el token almacenado existe Y no está expirado.
   * Decodifica el campo exp del payload JWT (client-side, no es validación criptográfica).
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Métodos existentes para compatibilidad
  loginClientJson(credentials: { email: string, password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login-json`, credentials).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.access_token);
        const userFromResponse = response.user as User;
        this.setUser(userFromResponse, response.access_token);
      }),
      catchError((error) => {
        console.error('Error en loginClientJson:', error);
        throw error;
      })
    );
  }

  registerClient(clientData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-client`, clientData).pipe(
      catchError((error) => {
        console.error('Error en registerClient:', error);
        throw error;
      })
    );
  }

  registerProvider(providerData: any): Observable<any> {
    // El backend espera multipart/form-data
    const formData = new FormData();
    formData.append('email', providerData.email);
    formData.append('password', providerData.password);
    formData.append('full_name', providerData.full_name);
    formData.append('run', providerData.run);
    
    if (providerData.phone) {
      formData.append('phone', providerData.phone);
    }
    formData.append('bio', providerData.bio || '');
    // El backend espera UploadFile para avatar, no string.
    // Solo enviar si es base64 (foto cargada por el usuario), convertida a Blob.
    if (providerData.avatar && providerData.avatar.startsWith('data:')) {
      const blob = this.base64ToBlob(providerData.avatar);
      formData.append('avatar', blob, 'avatar.jpg');
    }
    // Si es URL (avatar por defecto), no enviar el campo — el backend asigna su propio default.
    formData.append('terms_accepted', providerData.terms_accepted === true ? 'true' : 'false');
    formData.append('email_opt_in', providerData.email_opt_in === true ? 'true' : 'false');

    return this.http.post(`${this.apiUrl}/auth/register-provider`, formData).pipe(
      tap((response: any) => {
        if (response && response.id) {
          // Crear un objeto temporal que cumpla con la interfaz UserProfile
          const newUserProfile: Partial<UserProfile> = {
            id: response.id,
            email: providerData.email,
            role: 'PROVIDER',
            access_token: response.token || '',
            full_name: providerData.full_name
          };
          
          // Convertir a User para setUser
          const newUser: User = {
            id: response.id,
            email: providerData.email,
            role: 'PROVIDER',
            access_token: response.token || '',
            name: providerData.full_name
          };
          
          this.setUser(newUser, response.token);
          // También guardar como perfil si hay más datos
          if (providerData.full_name) {
            this.setUserProfile(newUserProfile);
          }
        }
      }),
      catchError((error) => {
        console.error('Error en registerProvider:', error);
        console.error('Error detail (422):', JSON.stringify(error.error));
        throw error;
      })
    );
  }

  private base64ToBlob(base64: string): Blob {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }

  /**
   * Actualiza solo los servicios del proveedor
   */
  refreshProviderServices(providerService: ProviderService): Observable<ServiceProviderData[]> {
    this.isLoadingSubject.next(true);
    
    const currentUser = this.getCurrentUser();
    const providerId = currentUser?.provider_id || currentUser?.id;
    
    if (!providerId) {
      this.isLoadingSubject.next(false);
      throw new Error('No hay ID de proveedor disponible');
    }
    
    return providerService.getProviderServices(providerId.toString()).pipe(
      map((services: any[]) => services as ServiceProviderData[]),
      tap({
        next: (services: ServiceProviderData[]) => {
          console.log('Servicios actualizados:', services.length, 'servicios');
          this.setProviderServices(services);
          this.isLoadingSubject.next(false);
        },
        error: (error) => {
          console.error('Error actualizando servicios:', error);
          this.isLoadingSubject.next(false);
        }
      })
    );
  }

  /**
   * Forzar recarga de todos los datos
   */
  reloadProviderData(providerService: ProviderService): Observable<{ profile: ProviderProfile; services: ServiceProviderData[] }> {
    console.log('Forzando recarga de datos del proveedor...');
    this.clearProfileData();
    return this.loadCompleteProviderData(providerService);
  }

  /**
   * Verifica el email usando el token recibido por correo
   */
  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verify-email`, { params: { token } });
  }

  /**
   * Solicita (o reenvía) el email de verificación
   */
  resendVerificationEmail(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/send-verification-email`, { email });
  }

  /**
   * Inicia el proceso de recuperación de contraseña
   */
  resetPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { email });
  }

  /**
   * Establece una nueva contraseña usando el token de recuperación
   */
  setNewPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/set-new-password`, { 
      token, 
      new_password: newPassword 
    });
  }
}