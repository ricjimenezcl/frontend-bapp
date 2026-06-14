import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PaymentRedirectService } from '../../../services/payment-redirect.service';

// ═══ Interfaces ═══════════════════════════════════════════════════

export interface UnlockStatus {
  is_unlocked: boolean;
  expires_at: string | null;
  days_remaining: number | null;
  hours_remaining: number | null;
  unlock_id: number | null;
  total_viewers: number;
  price_clp: number;
  duration_days: number;
}

export interface ServiceViewerClient {
  id: number;
  display_name: string;
  avatar_url: string | null;
  phone: string;
  service_viewed: string;
  viewed_at: string;
  is_masked: boolean;
}

export interface ServiceViewersResponse {
  is_unlocked: boolean;
  clients: ServiceViewerClient[];
  total: number;
  price_clp: number;
}

type PanelState = 'loading' | 'locked' | 'unlocked' | 'paying' | 'confirming' | 'error';

// ═══ Component ════════════════════════════════════════════════════

@Component({
  selector: 'app-service-viewers-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './service-viewers-modal.component.html',
  styleUrls: ['./service-viewers-modal.component.scss']
})
export class ServiceViewersModalComponent implements OnInit {
  
  // ── State ──
  state: PanelState = 'loading';
  unlockStatusData: UnlockStatus | null = null;
  clients: ServiceViewerClient[] = [];
  total = 0;
  unlockLoading = false;
  paymentRef: string | null = null;
  errorMsg = '';

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly paymentRedirect: PaymentRedirectService
  ) {}

  ngOnInit() {
    // Usar API real como en el proyecto web
    this.loadStatus();
  }

  // ═══ DEMO Data ═══════════════════════════════════════════════════

  private loadDemoData(): void {
    this.state = 'loading';
    
    // Simular carga
    setTimeout(() => {
      // Datos de prueba
      this.clients = [
        {
          id: 1,
          display_name: 'María González',
          avatar_url: null,
          phone: '+56912345678',
          service_viewed: 'Limpieza de hogar',
          viewed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          is_masked: false
        },
        {
          id: 2,
          display_name: 'Carlos Ramírez',
          avatar_url: null,
          phone: '+56987654321',
          service_viewed: 'Plomería',
          viewed_at: new Date(Date.now() - 86400000).toISOString(),
          is_masked: false
        },
        {
          id: 3,
          display_name: 'Ana López',
          avatar_url: null,
          phone: '+56923456789',
          service_viewed: 'Electricidad',
          viewed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          is_masked: false
        },
        {
          id: 4,
          display_name: 'Pedro Silva',
          avatar_url: null,
          phone: '+56934567890',
          service_viewed: 'Gasfitería',
          viewed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          is_masked: false
        }
      ];
      
      this.total = 4;
      
      // Cambiar entre locked y unlocked para probar ambos estados
      // Para probar locked: demoUnlocked = false
      // Para probar unlocked: demoUnlocked = true
      const demoUnlocked = false; // Cambiar a true para probar estado desbloqueado
      
      if (demoUnlocked) {
        this.state = 'unlocked';
        this.unlockStatusData = {
          is_unlocked: true,
          expires_at: new Date(Date.now() + 86400000 * 5).toISOString(),
          days_remaining: 5,
          hours_remaining: 120,
          unlock_id: 1,
          total_viewers: 4,
          price_clp: 1990,
          duration_days: 7
        };
      } else {
        this.state = 'locked';
      }
    }, 800);
  }

  // ═══ API Methods ═════════════════════════════════════════════════

  loadStatus(): void {
    this.state = 'loading';
    this.http.get<UnlockStatus>(`${environment.apiUrl}/providers/service-viewers/status`).subscribe({
      next: (s) => {
        this.unlockStatusData = s;
        if (s.total_viewers > 0) this.total = s.total_viewers;
        this.loadClients();
      },
      error: (err) => {
        console.warn('API no disponible, usando datos demo:', err);
        // Si falla la API, usar datos demo
        this.loadDemoData();
      }
    });
  }

  private loadClients(): void {
    this.http.get<ServiceViewersResponse>(`${environment.apiUrl}/providers/service-viewers/clients`).subscribe({
      next: (r) => {
        this.clients = r.clients;
        this.total = r.total;
        this.state = r.is_unlocked ? 'unlocked' : 'locked';
      },
      error: (err) => {
        console.warn('Error cargando clientes, usando demo:', err);
        // Si falla, cargar datos demo
        this.loadDemoData();
      }
    });
  }

  startUnlock(): void {
    // En modo demo, simular el proceso
    if (!environment.apiUrl || this.clients.length === 4) {
      // Demo mode: simular unlock inmediato
      this.unlockLoading = true;
      
      setTimeout(() => {
        this.state = 'unlocked';
        this.unlockLoading = false;
        this.unlockStatusData = {
          is_unlocked: true,
          expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
          days_remaining: 7,
          hours_remaining: 168,
          unlock_id: 1,
          total_viewers: 4,
          price_clp: 1990,
          duration_days: 7
        };
      }, 1500);
      
      return;
    }
    
    // Modo real: cerrar modal y abrir pago en bappsearch.com
    this.modalCtrl.dismiss();
    this.paymentRedirect.openProviderLeads('/provider/tabs/home');
  }

  confirmPayment(): void {
    if (!this.paymentRef) return;
    
    this.unlockLoading = true;
    this.state = 'confirming';
    
    this.http.post<{ success: boolean; expires_at: string }>(
      `${environment.apiUrl}/providers/service-viewers/confirm-payment`,
      { payment_reference: this.paymentRef }
    ).subscribe({
      next: () => {
        this.unlockLoading = false;
        this.loadStatus();
      },
      error: (err) => {
        const detail = err?.error?.detail ?? 'Error confirmando el pago.';
        this.errorMsg = detail;
        this.state = 'error';
        this.unlockLoading = false;
      }
    });
  }

  goToChat(clientId: number): void {
    // En modo demo, solo mostrar en consola
    if (!environment.apiUrl || this.clients.length === 4) {
      const client = this.clients.find(c => c.id === clientId);
      console.log('🗨️ Demo: Abrir chat con', client?.display_name);
      // En producción, esto navegaría al chat real
      return;
    }
    
    // Modo real
    this.modalCtrl.dismiss();
    this.router.navigate(['/provider/tabs/inbox'], { 
      queryParams: { clientId } 
    });
  }

  retry(): void {
    this.errorMsg = '';
    this.loadStatus();
  }

  // ═══ UI Methods ══════════════════════════════════════════════════

  close() {
    this.modalCtrl.dismiss();
  }

  formatPhone(phone: string): string {
    if (phone === '***' || !phone) return '***-***-****';
    
    // Formato chileno: +56 9 1234 5678
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      return `+56 9 ${cleaned.slice(-8, -4)} ${cleaned.slice(-4)}`;
    }
    return phone;
  }

  timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'hace momentos';
    if (minutes < 60) return `hace ${minutes} min`;
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${days}d`;
  }

  get countdownLabel(): string {
    if (!this.unlockStatusData) return '';
    
    const { days_remaining, hours_remaining } = this.unlockStatusData;
    
    if (days_remaining && days_remaining > 0) {
      return `${days_remaining}d restantes`;
    }
    if (hours_remaining && hours_remaining > 0) {
      return `${hours_remaining}h restantes`;
    }
    return 'menos de 1h';
  }
}
