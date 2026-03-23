import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * 🎯 CLASE BASE PARA TODOS LOS COMPONENTES Y PAGES
 *
 * ✅ Proporciona:
 * - destroy$ Subject para limpiar subscripciones automáticamente
 * - withDestroySubject() helper para takeUntil
 * - ngOnDestroy automático (NO lo implementes en componentes hijos)
 *
 * 📝 IMPORTANTE PARA ANGULAR 20 (Evita errores de "override"):
 *
 * ✅ CORRECTO - 90% de casos (NO IMPLEMENTES OnDestroy):
 * export class MiPage extends BaseComponent implements OnInit {
 *   constructor() { super(); }
 *   ngOnInit() { }
 *   // ❌ NO HAGAS: ngOnDestroy()
 *   // ✅ ngOnDestroy se ejecuta automáticamente aquí
 * }
 *
 * ✅ CORRECTO - Si necesitas cleanup adicional (USA override):
 * export class MiPage extends BaseComponent implements OnInit, OnDestroy {
 *   override ngOnDestroy() {
 *     console.log('Limpiando recursos...');
 *     // Tu código aquí
 *     super.ngOnDestroy(); // ✅ OBLIGATORIO
 *   }
 * }
 *
 * 📌 REGLA: Si extends BaseComponent, NO implementes OnDestroy a menos que necesites hacer algo extra.
 *
 * 🔄 PATRÓN DE USO CON OBSERVABLES:
 * export class MiPage extends BaseComponent implements OnInit {
 *   data$ = this.service.getData().pipe(
 *     this.withDestroySubject()  // ✅ Se limpia automáticamente
 *   );
 *
 *   constructor(private service: MyService) { super(); }
 *
 *   ngOnInit() {
 *     this.data$
 *       .pipe(this.withDestroySubject())  // ✅ También aquí
 *       .subscribe(data => { ... });
 *   }
 * }
 */
@Component({
  template: ''
})
export abstract class BaseComponent implements OnDestroy {
  /**
   * ✅ Subject que se completa automáticamente cuando el componente se destruye
   * Úsalo con withDestroySubject() para limpiar subscripciones automáticamente
   * Previene memory leaks
   */
  protected destroy$ = new Subject<void>();

  /**
   * ✅ SE EJECUTA AUTOMÁTICAMENTE - No lo implementes en componentes hijos
   * A menos que necesites hacer algo extra (entonces usa override)
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * 🔄 OPERADOR PARA LIMPIAR SUBSCRIPCIONES AUTOMÁTICAMENTE
   *
   * ✅ CORRECTO - Úsalo en TODOS tus observables:
   * this.observable$
   *   .pipe(this.withDestroySubject())
   *   .subscribe(data => { ... });
   *
   * ❌ NO HAGAS:
   * this.observable$.subscribe(data => { ... }); // Sin takeUntil = memory leak
   *
   * @returns Operador RxJS takeUntil que limpia automáticamente al destruir
   */
  protected withDestroySubject<T>() {
    return takeUntil<T>(this.destroy$);
  }
}