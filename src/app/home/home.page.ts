import { Component, ElementRef, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { register } from 'swiper/element/bundle'; 
import Swiper from 'swiper';

// Registrar componentes de Swiper
register();

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChild('swiper', { static: false }) swiperRef?: ElementRef;
  
  activeIndex: number = 0;

  constructor(
    private router: Router // Para navegación
  ) {}

  ngOnInit() {
  }

  ngAfterViewInit() {
    // Método requerido por AfterViewInit
  }

  changed() {
    // Corrige la referencia a swiperRef
    if (this.swiperRef?.nativeElement?.swiper) {
      this.activeIndex = this.swiperRef.nativeElement.swiper.activeIndex;
    }
  }
  
  onNext() {
    if (!this.swiperRef?.nativeElement?.swiper) {
      return;
    }
    
    const swiper = this.swiperRef.nativeElement.swiper;
    
    if (swiper.isEnd) {
      console.log('auth screen');
      this.router.navigate(['/auth']);
    } else {
      swiper.slideNext();
    }
  }
}