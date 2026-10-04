// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, providerGuard, clientGuard } from './features/auth/guards/auth.guard';
import { providerVerificationGuard } from './features/auth/guards/verification.guard';
import { profileCompletionGuard } from './features/auth/guards/profile-completion.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },

  // ==================== AUTH ====================
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login.page').then(m => m.LoginPage),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage),
      },
      {
        path: 'set-new-password',
        loadComponent: () => import('./features/auth/pages/set-new-password/set-new-password.page').then(m => m.SetNewPasswordPage),
      },
      {
        path: 'register-client',
        loadComponent: () => import('./features/auth/pages/register-client/register-client.page').then(m => m.RegisterClientPage),
      },
      {
        path: 'register-provider',
        loadComponent: () => import('./features/auth/pages/register-provider/register-provider.page').then(m => m.RegisterProviderPage),
      },
      {
        path: 'verify-identity',
        loadComponent: () => import('./features/auth/pages/document-verification/document-verification.page').then(m => m.DocumentVerificationPage),
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./features/auth/pages/email-verification/email-verification.page').then(m => m.EmailVerificationPage),
      },
      {
        path: 'terms-acceptance',
        loadComponent: () => import('./features/auth/pages/terms-acceptance/terms-acceptance.page').then(m => m.TermsAcceptancePage),
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },

  // ==================== CLIENT ====================
  {
    path: 'client',
    canActivate: [authGuard, clientGuard],
    children: [
      {
        path: 'tabs',
        loadComponent: () => import('./features/client/pages/tabs/tabs.page').then(m => m.ClientTabsPage),
        children: [
          {
            path: 'home',
            loadComponent: () => import('./features/client/pages/home/client-home.page').then(m => m.ClientHomePage)
          },
          {
            path: 'service-search',
            loadComponent: () => import('./features/client/pages/service-search/service-search.page').then(m => m.ServiceSearchPage)
          },
          {
            path: 'bookings',
            loadComponent: () => import('./features/client/pages/bookings/bookings.page').then(m => m.ClientBookingsPage)
          },
          {
            path: 'profile',
            loadComponent: () => import('./features/client/pages/client-profile/client-profile.page').then(m => m.ClientProfilePage)
          },
          {
            path: 'chats',
            loadComponent: () => import('./features/client/pages/client-chats/client-chats.page').then(m => m.ClientChatsPage)
          },
          {
            path: '',
            redirectTo: 'home',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: 'edit-profile',
        loadComponent: () => import('./features/client/pages/edit-profile/edit-profile.page').then(m => m.EditProfilePage)
      },

      {
        path: 'settings',
        loadComponent: () => import('./features/client/pages/settings/settings.page').then(m => m.SettingsPage)
      },
      {
        path: 'settings/languages',
        loadComponent: () => import('./features/client/pages/settings/languages/languages.page').then(m => m.LanguagesPage)
      },
      {
        path: 'settings/help',
        loadComponent: () => import('./features/client/pages/settings/help/help.page').then(m => m.HelpPage)
      },

      {
        path: 'categories',
        loadComponent: () => import('./features/client/pages/main-categories/main-categories.page').then(m => m.MainCategoriesPage)
      },

      {
        path: 'provider-info/:id',
        loadComponent: () => import('./features/client/pages/provider-info/provider-info.page').then(m => m.ProviderInfoPage)
      },
      {
        path: 'chat/:id',
        loadComponent: () => import('./features/chat/chat.page').then(m => m.ChatPage)
      },
      {
        path: '',
        redirectTo: 'tabs',
        pathMatch: 'full'
      }
    ]
  },

  // ==================== PROVIDER ====================
  {
    path: 'provider',
    canActivate: [authGuard, providerGuard, providerVerificationGuard, profileCompletionGuard],
    children: [
      {
        path: 'tabs',
        loadComponent: () => import('./features/provider/pages/tabs/tabs.page').then(m => m.ProviderTabsPage),
        children: [
          { path: 'home',            loadComponent: () => import('./features/provider/pages/provider-home/provider-home.page').then(m => m.ProviderHomePage) },
          { path: 'bookings',        loadComponent: () => import('./features/provider/pages/provider-bookings/provider-bookings.page').then(m => m.ProviderBookingsPage) },
          { path: 'inbox',          loadComponent: () => import('./features/provider/pages/provider-inbox/provider-inbox.page').then(m => m.ProviderInboxPage) },
          { path: 'profile',         loadComponent: () => import('./features/provider/pages/provider-profile/provider-profile.page').then(m => m.ProviderProfilePage) },
          { path: 'service-details', loadComponent: () => import('./features/provider/pages/provider-service-details/provider-service-details.page').then(m => m.ProviderServiceDetailsPage) },
          { path: '',               redirectTo: 'home', pathMatch: 'full' }
        ]
      },
      {
        path: 'add-service',
        loadComponent: () => import('./features/provider/pages/provider-add-service/provider-add-service.page').then(m => m.ProviderAddServicePage)
      },
      {
        path: 'edit-service/:id',
        loadComponent: () => import('./features/provider/pages/provider-edit-service/provider-edit-service.page').then(m => m.ProviderEditServicePage)
      },
      {
        path: 'service-details/:id',
        loadComponent: () => import('./features/provider/pages/provider-service-details/provider-service-details.page').then(m => m.ProviderServiceDetailsPage)
      },
      {
        path: 'account-info',
        loadComponent: () => import('./features/provider/pages/provider-account-info/provider-account-info.page').then(m => m.ProviderAccountInfoPage)
      },
      {
        path: 'working-hours',
        loadComponent: () => import('./features/provider/pages/provider-working-hours/provider-working-hours.page').then(m => m.ProviderWorkingHoursPage)
      },
      {
        path: 'chat/:id',
        loadComponent: () => import('./features/chat/chat.page').then(m => m.ChatPage)
      },
      {
        path: '',
        redirectTo: 'tabs',
        pathMatch: 'full'
      }
    ]
  },

  // ==================== SHARED ====================
  {
    path: 'notifications',
    loadComponent: () => import('./shared/pages/notifications/notifications.page').then(m => m.NotificationsPage),
    canActivate: [authGuard]
  },
  {
    path: 'transactions',
    loadChildren: () => import('./pages/transactions/transactions.module').then(m => m.TransactionsPageModule),
    canActivate: [authGuard]
  },

  // ==================== LEGAL ====================
  {
    path: 'terms',
    loadComponent: () => import('./shared/pages/terms/terms.page').then(m => m.TermsPage),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./shared/pages/privacy/privacy.page').then(m => m.PrivacyPage),
  },

  // ==================== FALLBACK ====================
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
