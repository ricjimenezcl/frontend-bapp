# BAPP Design System - Guía de Estilos

## Origen: `src/app/client/`

Esta guía documenta los patrones de diseño implementados en la carpeta `client` que deben replicarse en el resto del proyecto.

---

## 1. Estructura de Página

### Pattern Base
```html
<ion-content class="[page]-content">
  <div class="[page]-wrapper">
    <!-- Contenido -->
  </div>
</ion-content>
```

### Variables Usadas
- `ion-content --background: var(--bapp-bg-page)`
- Wrapper padding-bottom: `var(--bapp-space-8)` (para evitar corte en tabs)

---

## 2. Cards (Tarjetas)

### Card Estándar
```scss
.card {
  background: var(--bapp-surface-card);  // #232323
  border: 1px solid var(--bapp-border-default);  // rgba(255,255,255,0.08)
  border-radius: var(--bapp-radius-xl);  // 20px
  padding: var(--bapp-space-4);  // 16px
}
```

### Info Card (ej: profile)
```scss
.info-card {
  @include flex-column;
  gap: 3px;
  padding: var(--bapp-space-3);
  background: var(--bapp-surface-card);
  border: 1px solid var(--bapp-border-default);
  border-radius: var(--bapp-radius-xl);
  
  .info-icon { font-size: var(--bapp-text-xl); color: var(--bapp-color-primary); }
  .info-label { 
    font-size: var(--bapp-text-2xs);  // 12px
    font-weight: var(--bapp-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .info-value { font-size: var(--bapp-text-xs); }
}
```

---

## 3. Headers / Toolbar

### Pattern
```scss
ion-header.tabs-header {
  flex-shrink: 0;
  z-index: var(--bapp-z-sticky);
  
  .tabs-toolbar {
    --background: var(--bapp-bg-card);
    --border-color: var(--bapp-border);
    --min-height: 56px;
    --padding-start: var(--bapp-space-4);
    --padding-end: var(--bapp-space-3);
    box-shadow: 0 1px 0 var(--bapp-border);
  }
}

.tabs-title {
  font-size: var(--bapp-text-lg);  // 18px
  font-weight: var(--bapp-font-bold);
  color: var(--bapp-text-primary);
  letter-spacing: -0.02em;
}
```

---

## 4. Botones

### Botón Principal (Primary)
```scss
.submit-btn {
  @include button-primary;
  // background: var(--bapp-color-primary)
  // color: var(--bapp-color-on-primary) (#141414)
  // border-radius: var(--bapp-radius-full)
  // min-height: 48px
  // font-size: var(--bapp-text-sm)
}
```

### Botón Secundario
```scss
.submit-btn.secondary {
  @include button-secondary;
  // background: transparent
  // color: var(--bapp-color-primary)
  // border: 1.5px solid var(--bapp-color-primary)
}
```

### Botón de Icono (New Search)
```scss
.new-search-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--bapp-radius-lg);
  background: var(--bapp-bg-card-raised);
  border: 1px solid var(--bapp-border);
  @include flex-center;
  
  ion-icon { font-size: 18px; color: var(--bapp-text-secondary); }
}
```

---

## 5. Formularios / Inputs

### Input Wrap
```scss
.input-wrap {
  display: flex;
  align-items: center;
  background: var(--bapp-bg-input);
  border: 1.5px solid var(--bapp-border);
  border-radius: var(--bapp-radius-lg);
  padding: var(--bapp-space-3) var(--bapp-space-4);
  transition: border-color var(--bapp-transition-fast);
  
  &:focus-within {
    border-color: var(--bapp-color-primary);
    box-shadow: 0 0 0 3px rgba(253, 215, 53, 0.15);
  }
  
  &.input-wrap-error {
    border-color: var(--bapp-color-danger);
  }
  
  .input-icon {
    color: var(--bapp-text-tertiary);
    margin-right: var(--bapp-space-2);
  }
  
  ion-input {
    --background: transparent;
    --color: var(--bapp-text-primary);
    --placeholder-color: var(--bapp-text-disabled);
  }
}

.form-label {
  font-size: var(--bapp-text-sm);
  font-weight: var(--bapp-weight-medium);
  color: var(--bapp-text-secondary);
  margin-bottom: var(--bapp-space-1);
  display: block;
}

.form-error {
  font-size: var(--bapp-text-xs);
  color: var(--bapp-color-danger);
  margin-top: 4px;
}
```

---

## 6. Listas / Menú Items

### Menu List
```scss
.menu-list {
  background: var(--bapp-surface-card);
  border: 1px solid var(--bapp-border-default);
  border-radius: var(--bapp-radius-xl);
  overflow: hidden;
}

.menu-item {
  @include flex-start;
  gap: var(--bapp-space-3);
  width: 100%;
  padding: var(--bapp-space-3) var(--bapp-space-4);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--bapp-border-subtle);
  cursor: pointer;
  text-align: left;
  
  &:last-child { border-bottom: none; }
  &:active { background: var(--bapp-surface-hover); }
  
  .menu-label {
    flex: 1;
    font-size: var(--bapp-text-sm);
    font-weight: var(--bapp-weight-medium);
    color: var(--bapp-text-primary);
  }
  
  .menu-chevron {
    font-size: 16px;
    color: var(--bapp-text-disabled);
  }
}
```

### Menu Icon Variants
```scss
.menu-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--bapp-radius-lg);
  @include flex-center;
  
  ion-icon { font-size: 17px; }
}

.menu-icon-blue   { background: rgba(14,165,233,0.12); ion-icon { color: var(--bapp-color-accent); } }
.menu-icon-green  { background: rgba(34,197,94,0.12); ion-icon { color: var(--bapp-color-success); } }
.menu-icon-gold   { background: rgba(253,215,53,0.14); ion-icon { color: #C89800; } }
.menu-icon-slate  { background: rgba(100,116,139,0.14); ion-icon { color: #94A3B8; } }
.menu-icon-violet { background: rgba(168,85,247,0.12); ion-icon { color: #A855F7; } }
.menu-icon-orange { background: rgba(249,115,22,0.12); ion-icon { color: #F97316; } }
```

---

## 7. Bottom Tab Bar

```scss
ion-footer.tabs-footer {
  flex-shrink: 0;
  background: var(--bapp-bg-card);
  border-top: 1px solid var(--bapp-border);
  box-shadow: 0 -4px 20px rgba(0,0,0,0.28);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab-btn {
  flex: 1;
  @include flex-column-center;
  gap: 3px;
  border: none;
  background: transparent;
  padding: var(--bapp-space-2) var(--bapp-space-1);
  
  &.tab-btn-active::before {
    // Indicator bar
    transform: translateX(-50%) scaleX(1);
  }
}

.tab-icon-wrap {
  position: relative;
  @include flex-center;
  width: 32px;
  height: 32px;
  border-radius: var(--bapp-radius-lg);
  
  ion-icon { font-size: 22px; }
}

.tab-label {
  font-size: var(--bapp-text-xs);
  font-weight: var(--bapp-font-medium);
  color: var(--bapp-text-tertiary);
}
```

---

## 8. Provider Card (para listas)

```scss
.provider-card {
  display: flex;
  gap: var(--bapp-space-3);
  padding: var(--bapp-space-4);
  background: var(--bapp-surface-card);
  border: 1px solid var(--bapp-border-default);
  border-radius: var(--bapp-radius-xl);
  cursor: pointer;
  
  .provider-avatar-wrap {
    position: relative;
    .provider-avatar {
      width: 64px;
      height: 64px;
      border-radius: var(--bapp-radius-lg);
      object-fit: cover;
    }
    .online-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--bapp-color-success);
      border: 2px solid var(--bapp-bg-card);
    }
  }
  
  .provider-info {
    flex: 1;
    min-width: 0;
    
    .provider-name {
      font-size: var(--bapp-text-md);
      font-weight: var(--bapp-weight-semibold);
      color: var(--bapp-text-primary);
    }
    
    .provider-meta {
      display: flex;
      align-items: center;
      gap: var(--bapp-space-2);
      font-size: var(--bapp-text-xs);
      color: var(--bapp-text-secondary);
    }
  }
}
```

---

## 9. Chip / Tag

```scss
.chip-service {
  font-size: var(--bapp-text-xs);
  font-weight: var(--bapp-font-semibold);
  color: var(--bapp-text-secondary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--bapp-border);
  border-radius: var(--bapp-radius-full);
  padding: 2px 8px;
}

.menu-tag {
  font-size: var(--bapp-text-xs);
  font-weight: var(--bapp-font-bold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #C89800;
  background: rgba(253,215,53,0.15);
  border: 1px solid rgba(253,215,53,0.3);
  border-radius: var(--bapp-radius-full);
  padding: 2px 7px;
}
```

---

## 10. Empty State

```scss
.empty-state {
  @include flex-column-center;
  gap: var(--bapp-space-3);
  padding: var(--bapp-space-12) var(--bapp-space-6);
  text-align: center;
  
  ion-icon {
    font-size: 48px;
    color: var(--bapp-text-disabled);
    opacity: 0.6;
  }
  
  .empty-title {
    font-size: var(--bapp-text-md);
    font-weight: var(--bapp-font-semibold);
    color: var(--bapp-text-secondary);
  }
  
  .empty-subtitle {
    font-size: var(--bapp-text-sm);
    color: var(--bapp-text-tertiary);
    max-width: 260px;
  }
}
```

---

## 11. Variables de Diseño Clave

### Colores
- Background page: `var(--bapp-bg-page)` (#1A1A1A)
- Background card: `var(--bapp-surface-card)` / `var(--bapp-bg-card)` (#232323)
- Border: `var(--bapp-border)` (rgba(255,255,255,0.08))
- Text primary: `var(--bapp-text-primary)` (#FFFFFF)
- Text secondary: `var(--bapp-text-secondary)` (rgba(255,255,255,0.62))
- Primary (amarillo): `var(--bapp-color-primary)` (#FDE68A)

### Espaciados
- xs: 8px, sm: 12px, md: 16px, lg: 24px, xl: 32px

### Radios
- sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px, full: 9999px

---

## 12. Mixins Disponibles

- `@include flex-center`
- `@include flex-between`
- `@include flex-start`
- `@include flex-column`
- `@include flex-column-center`
- `@include card-style`
- `@include card-hover`
- `@include button-primary`
- `@include button-secondary`
- `@include button-ghost`
- `@include button-danger`
- `@include input-style`
- `@include truncate-text($lines)`
- `@include avatar($size)`
- `@include status-dot($size)`

---

*Documento generado automáticamente del análisis de `src/app/client/`*