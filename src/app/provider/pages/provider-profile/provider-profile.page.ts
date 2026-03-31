import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, ModalController, AlertController, ToastController, NavController } from '@ionic/angular';
import { ProviderAccountInfoPage } from '../provider-account-info/provider-account-info.page';
import { AuthService } from '../../../auth/services/auth.service';
import { ProviderService } from '../../services/provider.service';
import { ProviderProfile } from '../../../core/models/provider.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MonetizationComponentsModule } from '../../../components/monetization-components.module';

@Component({
  selector: 'app-provider-profile',
  templateUrl: './provider-profile.page.html',
  styleUrls: ['./provider-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, MonetizationComponentsModule]
})
export class ProviderProfilePage implements OnInit, OnDestroy {

  providerProfile: ProviderProfile | null = null;
  isLoading = false;
  private destroy$ = new Subject<void>();
  constructor(
    private router: Router,
    private navCtrl: NavController,
    private modalController: ModalController,
    private alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    private authService: AuthService,
    private providerService: ProviderService
  ) { }

  ngOnInit() {}

  ionViewWillEnter() {
    this.loadProviderProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar perfil del proveedor autenticado
   */
  private loadProviderProfile() {
    this.isLoading = true;
    
    this.providerService.getMyProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile: ProviderProfile) => {
          console.log('✅ Perfil del proveedor cargado:', profile);
          this.providerProfile = profile;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error cargando perfil:', error);
          this.isLoading = false;
        }
      });
  }

  onPage(link: any) {
    console.log("ingresa onPage", link);

    if (link === '/provider/provider-account-info') {
      this.openAccountInfoModal();
    } else if (link === 'invite-friends') {
      this.inviteFriends();
    } else {
      this.router.navigateByUrl(link);
    }
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
      try { await navigator.share(shareData); } catch { /* cancelled by user */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        await this.presentToast('Enlace copiado al portapapeles');
      } catch {
        await this.presentToast('No se pudo copiar el enlace');
      }
    }
  }

  private async presentToast(message: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom' });
    await toast.present();
  }

  private async openAccountInfoModal() {
    const modal = await this.modalController.create({
      component: ProviderAccountInfoPage,
      backdropDismiss: false,
      cssClass: 'account-info-modal'
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss();
    console.log('Modal cerrado con datos:', data, 'role:', role);
    
    // Recargar perfil después de actualizar
    if (role === 'confirm') {
      this.loadProviderProfile();
    }
  }

  async onSubmit() {
    console.log("ingresa submit");
    alert('Submit funcionando!');
  }

  onInbox() {
    console.log("ingresa inbox");
    this.router.navigate(['/provider/tabs/inbox']);
  }

  goToChat() {
    this.router.navigate(['/provider/tabs/inbox']);
  }

  goToTransactions() {
    this.router.navigate(['/transactions']);
  }

  goToCatalog() {
    this.router.navigate(['/product-catalog']);
  }

  async goSalir() {
    const alert = await this.alertCtrl.create({
      header: 'Salir',
      message: 'Esta seguro de cerrar sesion?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'custom-alert-dark',
          handler: () => {
            console.log('Confirm Cancel: blah');
          }
        }, {
          text: 'Okay',
          handler: async () => {
            this.authService.logout();
            this.navCtrl.navigateRoot(['/auth/login']);
          }
        }
      ]
    });
    
    await alert.present();
  }
}
