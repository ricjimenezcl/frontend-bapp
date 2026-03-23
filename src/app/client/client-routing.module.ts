import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full'
  },
  // ── DENTRO de tabs (muestran tab bar) ─────────────────────────────
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.ClientTabsPage),
    children: [
      {
        path: 'categories',
        loadComponent: () => import('./pages/main-categories/main-categories.page').then(m => m.MainCategoriesPage)
      }
    ]
  },
  // ── FUERA de tabs (NO muestran tab bar) ───────────────────────────
  {
    path: 'provider-info',
    loadComponent: () => import('./pages/provider-info/provider-info.page').then(m => m.ProviderInfoPage)
  },
  {
    path: 'edit-profile',
    loadComponent: () => import('./pages/edit-profile/edit-profile.page').then(m => m.EditProfilePage)
  },
  {
    path: 'chat/:id',
    loadComponent: () => import('../chat/chat.page').then(m => m.ChatPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage)
  },
  {
    path: 'settings/change-avatar',
    loadComponent: () => import('./pages/settings/change-avatar/change-avatar.page').then(m => m.ChangeAvatarPage)
  },
  {
    path: 'settings/change-password',
    loadComponent: () => import('./pages/settings/change-password/change-password.page').then(m => m.ChangePasswordPage)
  },
  {
    path: 'settings/languages',
    loadComponent: () => import('./pages/settings/languages/languages.page').then(m => m.LanguagesPage)
  },
  {
    path: 'settings/help',
    loadComponent: () => import('./pages/settings/help/help.page').then(m => m.HelpPage)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ClientRoutingModule { }
