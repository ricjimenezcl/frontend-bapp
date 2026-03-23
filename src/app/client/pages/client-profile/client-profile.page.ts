// src/app/client/pages/client-profile/client-profile.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { ClientService } from '../../services/client.service';
import { DEFAULT_AVATAR_URL } from '../../../core/constants/default-avatar';
import { MonetizationComponentsModule } from '../../../components/monetization-components.module';

@Component({
  selector: 'app-client-profile',
  templateUrl: './client-profile.page.html',
  styleUrls: ['./client-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MonetizationComponentsModule]
})
export class ClientProfilePage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  fullName = '';
  phone = '';
  email = '';
  bio = '';
  avatarPreview = DEFAULT_AVATAR_URL;
  avatar: string | null = null;

  user: {
    id: number;
    email: string;
    full_name: string;
    phone: string;
    avatar: string;
    role: string;
  } | null = null;

  profile: any = null;
  isLoading = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private clientService: ClientService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    const userId = typeof user?.id === 'string'
      ? parseInt(user?.id, 10)
      : user?.id as number;
    this.clientService.getClientById(userId).subscribe(profile => {
      this.fullName = profile?.full_name || (user as any)?.full_name || '';
      this.phone = profile?.phone || (user as any)?.phone || '';
      this.email = profile?.email || user?.email || '';
      this.bio = profile?.bio || '';
      this.avatar = profile?.avatar || (user as any)?.avatar || DEFAULT_AVATAR_URL;
    });
    
    console.log('Perfil obtenido en clientProfilePage:', user);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    // Mostrar datos de caché inmediatamente
    this.loadUserData();

    // Luego cargar datos frescos y completos (incluyendo bio) desde el nuevo endpoint
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) return;

    const userId = typeof currentUser.id === 'string'
      ? parseInt(currentUser.id, 10)
      : currentUser.id as number;

    this.isLoading = true;
    this.clientService.getClientById(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.isLoading = false;
          this.user = {
            id: data.user_id,
            email: data.email,
            full_name: data.full_name,
            phone: data.phone || '',
            avatar: data.avatar || DEFAULT_AVATAR_URL,
            role: currentUser.role || 'client'
          };
          // Actualizar caché con datos frescos (incluyendo bio)
          const existing = this.authService.getUserProfile();
          this.authService.setUserProfile({
            ...existing,
            full_name: data.full_name,
            phone: data.phone || '',
            avatar: data.avatar || undefined,
            bio: data.bio || ''
          });
        },
        error: () => {
          this.isLoading = false;
          // El caché ya fue mostrado por loadUserData()
        }
      });

      console.log('Cargando perfil del cliente con ID:', this.user);
  }

  private loadUserData() {
    const user = this.authService.getCurrentUser();
    const userId = typeof user?.id === 'string'
      ? parseInt(user?.id, 10)
      : user?.id as number;
    this.clientService.getClientById(userId).subscribe(profile => {
      this.fullName = profile?.full_name || (user as any)?.full_name || '';
      this.phone = profile?.phone || (user as any)?.phone || '';
      this.email = profile?.email || user?.email || '';
      this.bio = profile?.bio || '';
      this.avatar = profile?.avatar || (user as any)?.avatar || DEFAULT_AVATAR_URL;
    });
    // const user = this.authService.getCurrentUser();
    //     const userId = typeof user?.id === 'string'
    //       ? parseInt(user?.id, 10)
    //       : user?.id as number;
    //    const profile =  this.clientService.getClientById(userId)
    // //const profile = this.authService.getUserProfile();
    // console.log("CLIENT PROFILEEE : ",profile);

    // if (profile) {
    //   this.profile = profile;
    //   this.user = {
    //     id: typeof profile.id === 'string' ? parseInt(profile.id, 10) : profile.id,
    //     email: profile.email || '',
    //     full_name: profile.full_name || profile.name || 'Usuario',
    //     phone: profile.phone || '',
    //     avatar: profile.avatar || DEFAULT_AVATAR_URL,
    //     role: profile.role || 'client'
    //   };
    // } else {
    //   const currentUser = this.authService.getCurrentUser();
    //   if (currentUser) {
    //     this.user = {
    //       id: typeof currentUser.id === 'string' ? parseInt(currentUser.id, 10) : currentUser.id,
    //       email: currentUser.email || '',
    //       full_name: (currentUser as any).full_name || currentUser.name || 'Usuario',
    //       phone: (currentUser as any).phone || '',
    //       avatar: (currentUser as any).avatar || DEFAULT_AVATAR_URL,
    //       role: currentUser.role || 'client'
    //     };
    //   }
    // }
  }

  async goLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Sí, salir',
          handler: () => {
            this.authService.logout();
            this.router.navigate(['/auth/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  goToEditProfile() {
    this.router.navigate(['/client/edit-profile']);
  }

  goToBookings() {
    this.router.navigate(['/client/tabs/bookings']);
  }

  goToSettings() {
    this.router.navigate(['/client/settings']);
  }

  goToTransactions() {
    this.router.navigate(['/transactions']);
  }

  goToCatalog() {
    this.router.navigate(['/product-catalog']);
  }

  async inviteFriends() {
    const user = this.authService.getCurrentUser();
    const inviteUrl = `https://bapp.app/invite/${user?.id ?? ''}`;
    const shareData = {
      title: 'Únete a BAPP',
      text: 'Descarga BAPP y encuentra los mejores servicios cerca de ti.',
      url: inviteUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        await this.presentToast('Enlace copiado al portapapeles');
      } catch {
        await this.presentToast('No se pudo copiar el enlace', 'danger');
      }
    }
  }

  private async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
