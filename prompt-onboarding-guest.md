Actúa como un arquitecto de software, diseñador UI/UX experto, especialista en despliegues de apps móviles, experto en rendering y performance, y fullstack senior con experiencia avanzada en Angular 18, Ionic v8, Tailwind CSS, TypeScript y consumo de APIs REST.

Tu tarea es diseñar e implementar una nueva pantalla de onboarding para una app móvil dentro del proyecto de Ionic v8 que se encuentra en:

- Proyecto MOBILE (Ionic v8):
  /Users/rjimenezl/Documents/bapp/frontend-bapp/

- Backend (ya funcional y desplegado en Render):
  /Users/rjimenezl/Documents/bapp/backend-bapp/

El objetivo es eliminar la pantalla de login como pantalla de inicio del proyecto móvil, reemplazándola por una página de onboarding con 3 slides inspirada en la referencia entregada, pero adaptada al estilo visual y UX del proyecto actual.

Requerimientos funcionales

1. Pantalla de inicio:
- La app debe iniciar directamente en una pantalla de onboarding con 3 slides.
- Debe tener un diseño moderno, limpio, premium y consistente con la identidad visual del proyecto.
- El primer acceso debe permitir a cualquier persona navegar sin registro previo.
- Debe fomentar la exploración de servicios y la búsqueda sin requerir autenticación inicial.

2. Flujo de acceso público:
- Cualquier usuario, incluso sin registro, debe poder ingresar a la app y realizar búsquedas de servicios.
- La experiencia debe permitir navegar por la app como actualmente funciona, sin romper el flujo de usuarios registrados.
- Sin embargo, debe existir un sistema de restricciones para acciones sensibles:
  - no se debe permitir ver información de contacto del proveedor
  - no se debe permitir comunicación a través del chat
  - no se debe permitir reservar servicios
  - no se debe permitir ver disponibilidad de reserva real del proveedor
  - tampoco se debe permitir acceder a funciones de gestión o dashboard del proveedor

3. Restricciones para usuario Guest:
- Cuando un usuario Guest intente interactuar con un proveedor (contactar, reservar, iniciar chat, revisar disponibilidad, etc.), debe dispararse un modal de registro como cliente.
- Este modal debe obligar al usuario a registrarse como cliente antes de continuar con acciones que requieren cuenta.
- El flujo debe ser no bloqueante, pero claro y persuasivo.
- Debe indicar la ventaja de completar el registro para acceder a funciones reales.
- No debe afectar el funcionamiento de usuarios ya registrados.

4. Onboarding post-inicio:
- Después del onboarding, la aplicación debe presentar un modal o selector de intención:
  - “¿Qué quieres hacer?”
  - opciones: buscar servicios o ofrecer servicios
- Si el usuario elige “buscar servicios”, debe dirigirlo al flujo de búsqueda de servicios como usuario guest.
- Si el usuario elige “ofrecer servicios”, debe dirigirlo al dashboard del proveedor en modo Guest, con restricciones y sin acceso a funciones operativas reales.
- En ese dashboard guest, el usuario deberá ver información útil sobre los beneficios de registrarse como proveedor.
- Debe estar claramente deshabilitado el acceso a:
  - registro de servicios
  - revisión de chat
  - reservas
  - gestión del negocio
  - cualquier flujo funcional de proveedor
  - solo se debe mostrar contenido informativo, con CTA para registrarse

5. Modal de registro para proveedor guest:
- Si el usuario entra al flujo de proveedor guest y quiere continuar, se debe mostrar un modal de registro para proveedor.
- El diseño del modal debe ser claro, atractivo y orientado a conversión.
- Debe invitar al usuario a registrarse para acceder a todo el potencial del rol proveedor.
- Debe mantener intacta la experiencia actual para usuarios ya registrados.

6. Reglas de implementación:
- No modificar nada de lo existente.
- No tocar ni romper flujos ya funcionales para usuarios registrados.
- No alterar privilegios ni permisos actuales de usuarios logueados.
- No modificar absolutamente ningún flujo ajeno a lo solicitado.
- Mantener compatibilidad total con el backend ya funcional y desplegado en Render.
- No asumir cambios en APIs ni en lógica backend no solicitada.
- Cualquier cambio debe ser local al flujo de onboarding, guest mode y modales de registro.

7. Scope de la tarea:
- Diseñar y construir únicamente la nueva página de onboarding y la experiencia guest.
- Reutilizar patrones del proyecto donde exista, sin reescribir ni refactorizar módulos ajenos.
- Mantener la estructura del código actual y evitar cambios masivos.

8. Estilo de UI/UX:
- Debe verse premium, moderno, legible y orientado a móvil.
- Debe sentirse coherente con la app actual, con un look visual enfocado en servicios, proveedores, confianza y conversión.
- Prioriza claridad, jerarquía visual y pasos simples.
- Usa una navegación intuitiva y una acción principal muy clara por slide.
- El primer slide debe comunicar valor del servicio.
- El segundo slide debe reforzar confianza, rapidez y calidad.
- El tercer slide debe invitar al usuario a comenzar.

9. Entregable esperado:
- Debes entregar la implementación completa de la pantalla de onboarding con 3 slides, adaptada al proyecto.
- Debes mantener la lógica de navegación inicial.
- Debes crear o ajustar los elementos necesarios para cumplir con la experiencia guest.
- Debes respetar el diseño actual del proyecto y la arquitectura de Angular 18 + Ionic v8.
- Debes priorizar componentes reutilizables, legibilidad y mantenibilidad.

10. Validación:
- Antes de entregar, valida que la pantalla funcione correctamente en el contexto del proyecto móvil.
- Asegúrate de que no haya regressions con el flujo actual de autenticación.
- Cuida la experiencia en mobile y la compatibilidad con Ionic v8.

Importante:
No debes tocar el flujo de usuarios registrados ni sus permisos.
No debes modificar ningún flujo ajeno a esta tarea.
Solo debes enfocarte en la página de onboarding, la experiencia Guest y los modales de registro asociados.

Si hay que hacer un cambio mínimo en rutas o condiciones de acceso, debe ser solo el necesario para cumplir esta funcionalidad.

Quiero que esta tarea se ejecute con una implementación limpia, profesional, visualmente sólida y fiel a la arquitectura actual del proyecto.
