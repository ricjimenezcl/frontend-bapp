/**
 * User Model - Sincronizado con proyecto WEB
 * Define tipos y interfaces para usuarios, autenticación y perfiles
 */

export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

/**
 * Usuario completo con información de autenticación
 */
export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  access_token?: string;
  user_id?: number;
  provider_id?: number;
  client_id?: number;
  name?: string;
  picture?: string;
  verified?: boolean;
  terms_accepted?: boolean;
  has_premium?: boolean;
}

/**
 * Perfil de usuario con información detallada
 */
export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  has_premium?: boolean;
  phone?: string;
  avatar?: string | null;
  bio?: string;
  rating_avg?: number;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  run?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Usuario almacenado en localStorage/sessionStorage
 */
export interface StoredUser {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
  has_premium?: boolean;
}

/**
 * Request para login
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Response del backend tras login exitoso
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
}

/**
 * Request para registro de cliente
 */
export interface ClientRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
}

/**
 * Request para registro de proveedor
 */
export interface ProviderRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
  run?: string;
}
