## Proyecto: BAPP Frontend (Ionic v8 + Angular 18)

### Stack
- Ionic v8, Angular 18, TypeScript, SCSS
- Dark theme — variables en src/theme/variables.scss
- Mixins en src/theme/mixins.scss

### Reglas críticas
- NUNCA usar colores hex hardcodeados — usar variables --bapp-*
- NUNCA modificar archivos .ts sin confirmación
- NUNCA cambiar src/theme/variables.scss
- Siempre verificar con `ng build` tras cambios

### Patrón de referencia
- Auth pages: src/app/auth/pages/login/
- Profile pages: src/app/client/pages/client-profile/
- Formularios: src/app/provider/pages/provider-add-service/