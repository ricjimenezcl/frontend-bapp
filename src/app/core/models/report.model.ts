/**
 * Report Model - Sistema de Reportes y Moderación
 * Sincronizado con backend FastAPI
 */

export enum ReportType {
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  FAKE_PROFILE = 'FAKE_PROFILE',
  HARASSMENT = 'HARASSMENT',
  SPAM = 'SPAM',
  FRAUD = 'FRAUD',
  HATE_SPEECH = 'HATE_SPEECH',
  VIOLENCE = 'VIOLENCE',
  NUDITY = 'NUDITY',
  INTELLECTUAL_PROPERTY = 'INTELLECTUAL_PROPERTY',
  OTHER = 'OTHER'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
  ESCALATED = 'ESCALATED'
}

export enum ReportedEntityType {
  USER = 'USER',
  REVIEW = 'REVIEW',
  SERVICE = 'SERVICE',
  CHAT_MESSAGE = 'CHAT_MESSAGE'
}

export enum ModerationAction {
  NO_ACTION = 'NO_ACTION',
  WARNING = 'WARNING',
  CONTENT_REMOVED = 'CONTENT_REMOVED',
  TEMPORARY_SUSPENSION = 'TEMPORARY_SUSPENSION',
  PERMANENT_BAN = 'PERMANENT_BAN',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED'
}

export interface ReportCreate {
  report_type: ReportType;
  reported_entity_type: ReportedEntityType;
  reported_entity_id: number;
  reported_user_id?: number;
  description?: string;
  evidence_urls?: string[];
}

export interface ReportResponse {
  id: number;
  report_type: ReportType;
  reported_entity_type: ReportedEntityType;
  reported_entity_id: number;
  reporter_id: number;
  reported_user_id?: number;
  description?: string;
  evidence_urls?: string[];
  status: ReportStatus;
  reviewed_by?: number;
  reviewed_at?: string;
  review_notes?: string;
  action_taken?: ModerationAction;
  action_details?: string;
  created_at: string;
  updated_at?: string;
}

export interface ContentValidationRequest {
  text: string;
  context?: 'bio' | 'review' | 'chat' | 'service_description' | 'service_name';
}

export interface ContentValidationResponse {
  is_valid: boolean;
  blocked_words: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message?: string;
  suggested_text?: string;
}

export interface BlockedWord {
  id: number;
  word: string;
  pattern?: string;
  category: 'SEXUAL' | 'DRUGS' | 'VIOLENCE' | 'HATE' | 'FRAUD' | 'SPAM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  language: string;
  is_active: boolean;
  created_at: string;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  INAPPROPRIATE_CONTENT: 'Contenido inapropiado',
  FAKE_PROFILE: 'Perfil falso',
  HARASSMENT: 'Acoso',
  SPAM: 'Spam',
  FRAUD: 'Fraude o estafa',
  HATE_SPEECH: 'Discurso de odio',
  VIOLENCE: 'Violencia o amenazas',
  NUDITY: 'Contenido explícito',
  INTELLECTUAL_PROPERTY: 'Propiedad intelectual',
  OTHER: 'Otro motivo'
};

export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  INAPPROPRIATE_CONTENT: 'Contenido ofensivo o que viola las normas de la comunidad',
  FAKE_PROFILE: 'Perfil falso, suplantación de identidad o información engañosa',
  HARASSMENT: 'Acoso, intimidación, bullying o comportamiento abusivo',
  SPAM: 'Publicidad no solicitada, contenido repetitivo o spam',
  FRAUD: 'Actividad fraudulenta, estafa o intento de engaño',
  HATE_SPEECH: 'Discriminación, racismo, xenofobia u odio hacia grupos',
  VIOLENCE: 'Amenazas de violencia, contenido violento o peligroso',
  NUDITY: 'Contenido sexualmente explícito o inapropiado',
  INTELLECTUAL_PROPERTY: 'Uso no autorizado de contenido protegido por derechos de autor',
  OTHER: 'Otro motivo no listado arriba'
};

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  INAPPROPRIATE_CONTENT: 'alert-circle-outline',
  FAKE_PROFILE: 'person-remove-outline',
  HARASSMENT: 'warning-outline',
  SPAM: 'mail-unread-outline',
  FRAUD: 'card-outline',
  HATE_SPEECH: 'sad-outline',
  VIOLENCE: 'skull-outline',
  NUDITY: 'eye-off-outline',
  INTELLECTUAL_PROPERTY: 'document-text-outline',
  OTHER: 'ellipsis-horizontal-outline'
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pendiente',
  UNDER_REVIEW: 'En revisión',
  RESOLVED: 'Resuelto',
  DISMISSED: 'Desestimado',
  ESCALATED: 'Escalado'
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'primary',
  RESOLVED: 'success',
  DISMISSED: 'medium',
  ESCALATED: 'danger'
};
