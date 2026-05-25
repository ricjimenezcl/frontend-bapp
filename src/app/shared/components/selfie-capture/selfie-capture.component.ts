import { Component, OnDestroy, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonModal, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButton,
  IonIcon,
  IonProgressBar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, camera, checkmarkCircle, alertCircle } from 'ionicons/icons';

type LivenessStep = 'READY' | 'INIT_CAMERA' | 'CENTER' | 'TURN_RIGHT' | 'TURN_LEFT' | 'PROCESSING' | 'COMPLETE' | 'ERROR';

type FacePosition = 'center' | 'right' | 'left';

interface CapturedFrame {
  dataUrl: string;
  timestamp: number;
  position: FacePosition;
}

interface LivenessState {
  currentStep: LivenessStep;
  stepIndex: number;
  totalSteps: number;
  instruction: string;
  countdown: number;
  isCapturing: boolean;
  capturedFrames: CapturedFrame[];
  finalImage: string | null;
  error: string | null;
  faceDetected: boolean;
  faceStableTime: number; // Tiempo que el rostro ha estado estable en el óvalo
  requiredStableTime: number; // Tiempo requerido para captura (3 segundos)
  faceAbsentTime: number; // Tiempo sin detectar rostro (para tolerancia)
  gracePeriod: number; // Tiempo de gracia antes de resetear (500ms)
  ovalOffsetX: number; // Desplazamiento X del óvalo para seguir el rostro
  ovalOffsetY: number; // Desplazamiento Y del óvalo para seguir el rostro
  initialFaceX: number | null; // Posición X inicial del rostro (CENTER)
  headTurnDetected: boolean; // Si se detectó el giro de cabeza solicitado
}

@Component({
  selector: 'app-selfie-capture',
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonProgressBar
  ],
  templateUrl: './selfie-capture.component.html',
  styleUrls: ['./selfie-capture.component.scss']
})
export class SelfieCaptureComponent implements OnDestroy {
  @ViewChild('modal', { static: false }) modal!: IonModal;
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  
  @Output() photoTaken = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  state: LivenessState = {
    currentStep: 'READY',
    stepIndex: 0,
    totalSteps: 3,
    instruction: 'Presiona "Iniciar" para comenzar',
    countdown: 0,
    isCapturing: false,
    capturedFrames: [],
    finalImage: null,
    error: null,
    faceDetected: false,
    faceStableTime: 0,
    requiredStableTime: 3000, // 3 segundos en milisegundos
    faceAbsentTime: 0,
    gracePeriod: 800, // 800ms de tolerancia (más generoso)
    ovalOffsetX: 0,
    ovalOffsetY: 0,
    initialFaceX: null,
    headTurnDetected: false
  };

  private mediaStream: MediaStream | null = null;
  private countdownInterval?: any;
  private faceDetectionInterval?: any;
  private readonly steps: Array<{ step: LivenessStep; instruction: string; duration: number; position: FacePosition }> = [
    { step: 'CENTER', instruction: 'Mantén tu rostro de frente mirando a la cámara', duration: 3, position: 'center' },
    { step: 'TURN_RIGHT', instruction: '👉 Gira tu cabeza hacia TU DERECHA, luego vuelve al centro', duration: 2, position: 'right' },
    { step: 'TURN_LEFT', instruction: '👈 Gira tu cabeza hacia TU IZQUIERDA, luego vuelve al centro', duration: 2, position: 'left' }
  ];

  constructor() {
    addIcons({ close, camera, checkmarkCircle, alertCircle });
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    this.stopFaceDetection();
    this.stopCamera();
  }

  /**
   * Abre el modal
   */
  async open(): Promise<void> {
    await this.modal.present();
  }

  /**
   * Cierra el modal
   */
  async close(): Promise<void> {
    this.clearCountdown();
    this.stopFaceDetection();
    this.stopCamera();
    this.resetState();
    await this.modal.dismiss();
    this.cancelled.emit();
  }

  /**
   * Inicia la cámara
   */
  private async startCamera(): Promise<void> {
    try {
      this.state.currentStep = 'INIT_CAMERA';
      this.state.instruction = 'Iniciando cámara...';

      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.mediaStream;
        await this.videoElement.nativeElement.play();
        
        // Esperar a que el video esté listo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.state.currentStep = 'CENTER';
        this.state.instruction = 'Centra tu rostro en el óvalo';
      }
    } catch (error) {
      console.error('Error iniciando cámara:', error);
      this.state.error = 'No se pudo acceder a la cámara';
      this.state.currentStep = 'ERROR';
    }
  }

  /**
   * Detiene la cámara
   */
  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Inicia el proceso de liveness detection
   */
  async startLivenessCheck(): Promise<void> {
    this.state.stepIndex = 0;
    this.state.isCapturing = true;
    this.state.capturedFrames = [];
    
    await this.startCamera();
    
    // Iniciar el proceso de captura
    setTimeout(() => {
      this.runNextStep();
    }, 1000);
  }

  /**
   * Ejecuta el siguiente paso del proceso
   */
  private runNextStep(): void {
    if (this.state.stepIndex >= this.steps.length) {
      this.processCapture();
      return;
    }

    const step = this.steps[this.state.stepIndex];
    this.state.currentStep = step.step;
    this.state.instruction = step.instruction;
    this.state.faceStableTime = 0;
    this.state.faceAbsentTime = 0;
    this.state.headTurnDetected = false; // Resetear detección de giro

    // Iniciar detección continua de rostro
    this.startFaceDetection(step);
  }

  /**
   * Inicia la detección continua de rostro
   */
  private startFaceDetection(step: { step: LivenessStep; instruction: string; duration: number; position: FacePosition }): void {
    this.stopFaceDetection(); // Limpiar intervalo anterior si existe

    console.log('🎥 Iniciando detección continua de rostro para paso:', step.step);

    let lastCheckTime = Date.now();

    this.faceDetectionInterval = setInterval(() => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastCheckTime;
      lastCheckTime = currentTime;

      // Detectar si el rostro está completamente en el óvalo
      const faceRegionResult = this.detectFaceInFrameWithPosition();
      const faceInOval = faceRegionResult !== null;
      this.state.faceDetected = faceInOval;

      if (faceInOval && faceRegionResult) {
        // Guardar posición inicial en paso CENTER
        if (step.step === 'CENTER' && this.state.initialFaceX === null) {
          this.state.initialFaceX = this.state.ovalOffsetX; // Usar el offset del óvalo como referencia
          console.log(`📍 Offset inicial del óvalo guardado: X=${this.state.ovalOffsetX.toFixed(0)}`);
        }

        // Validar giro de cabeza para TURN_RIGHT y TURN_LEFT
        let canAccumulate = true;
        if ((step.step === 'TURN_RIGHT' || step.step === 'TURN_LEFT') && !this.state.headTurnDetected) {
          console.log(`🔍 Buscando giro ${step.step}... Offset: ${this.state.ovalOffsetX.toFixed(0)}, Inicial: ${this.state.initialFaceX?.toFixed(0)}`);
          this.validateHeadTurn(step.step, this.state.ovalOffsetX);
          canAccumulate = this.state.headTurnDetected;
          if (this.state.headTurnDetected) {
            console.log(`✅ ¡Giro detectado! Offset: ${this.state.ovalOffsetX.toFixed(0)}`);
          }
        }

        if (canAccumulate) {
          // Rostro detectado (y giro válido si aplica): resetear tiempo de ausencia y acumular tiempo estable
          this.state.faceAbsentTime = 0;
          this.state.faceStableTime += deltaTime;
          
          this.state.countdown = Math.ceil((this.state.requiredStableTime - this.state.faceStableTime) / 1000);
          console.log(`⏱️ Acumulando: ${(this.state.faceStableTime / 1000).toFixed(1)}s / ${this.state.requiredStableTime / 1000}s`);

          if (this.state.faceStableTime >= this.state.requiredStableTime) {
            console.log('📸 Capturando frame!');
            this.stopFaceDetection();
            this.captureFrame(step.position);
            this.state.stepIndex++;
            
            // Pequeña pausa antes del siguiente paso
            setTimeout(() => {
              this.runNextStep();
            }, 500);
          }
        }
      } else {
        // Rostro NO detectado: acumular tiempo de ausencia
        this.state.faceAbsentTime += deltaTime;
        
        if (this.state.faceAbsentTime >= this.state.gracePeriod) {
          if (this.state.faceStableTime > 0) {
            console.log(`❌ Rostro perdido por ${this.state.faceAbsentTime}ms - Reseteando timer`);
            this.state.faceStableTime = 0;
            this.state.countdown = step.duration;
          }
        } else {
          console.log(`⏸️ Rostro ausente: ${this.state.faceAbsentTime}ms / ${this.state.gracePeriod}ms`);
        }
      }
    }, 150); // Verificar cada 150ms (optimizado para velocidad)
  }

  /**
   * Valida si el giro de cabeza es correcto para el paso actual
   */
  private validateHeadTurn(step: LivenessStep, currentX: number): void {
    if (this.state.initialFaceX === null) {
      console.log('⚠️ No hay posición inicial guardada');
      return;
    }

    const displacement = currentX - this.state.initialFaceX;
    const minDisplacement = 40; // Píxeles mínimos (reducido de 50 a 40 para mayor sensibilidad)

    if (step === 'TURN_RIGHT') {
      // Para girar a la derecha, el rostro debe moverse a la IZQUIERDA en la imagen (efecto espejo)
      const isTurned = displacement < -minDisplacement;
      if (isTurned && !this.state.headTurnDetected) {
        this.state.headTurnDetected = true;
        console.log(`✅ ¡Giro a la derecha detectado! Desplazamiento: ${displacement.toFixed(0)}px - Ahora mantén tu rostro visible`);
      }
    } else if (step === 'TURN_LEFT') {
      // Para girar a la izquierda, el rostro debe moverse a la DERECHA en la imagen (efecto espejo)
      const isTurned = displacement > minDisplacement;
      if (isTurned && !this.state.headTurnDetected) {
        this.state.headTurnDetected = true;
        console.log(`✅ ¡Giro a la izquierda detectado! Desplazamiento: ${displacement.toFixed(0)}px - Ahora mantén tu rostro visible`);
      }
    }
  }

  /**
   * Detiene la detección continua de rostro
   */
  private stopFaceDetection(): void {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = undefined;
    }
  }

  /**
   * Detecta si hay un rostro COMPLETO en el frame actual
   * Encuentra el rostro y ajusta el óvalo para adaptarse a él
   * Devuelve el objeto con la posición del rostro o null si no se detecta
   */
  private detectFaceInFrameWithPosition(): { centerX: number; centerY: number; confidence: number } | null {
    try {
      const video = this.videoElement?.nativeElement;
      const canvas = this.canvasElement?.nativeElement;
      
      if (!video || !canvas) return null;
      if (video.videoWidth === 0 || video.videoHeight === 0) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Configurar canvas con las dimensiones del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Dibujar frame actual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Buscar la región con más actividad facial (centro de masa del rostro)
      const faceRegion = this.findFaceRegion(ctx, canvas.width, canvas.height);
      
      if (!faceRegion) {
        console.log('❌ No se detectó región facial');
        return null;
      }

      // Ajustar el óvalo para centrarse en el rostro detectado (con suavizado)
      const targetOffsetX = faceRegion.centerX - canvas.width / 2;
      const targetOffsetY = faceRegion.centerY - canvas.height / 2;
      
      // Suavizar el movimiento del óvalo (interpolación)
      this.state.ovalOffsetX += (targetOffsetX - this.state.ovalOffsetX) * 0.3;
      this.state.ovalOffsetY += (targetOffsetY - this.state.ovalOffsetY) * 0.3;
      
      console.log(`📐 OvalOffset: X=${this.state.ovalOffsetX.toFixed(0)}, Y=${this.state.ovalOffsetY.toFixed(0)} | Target: X=${targetOffsetX.toFixed(0)}, Y=${targetOffsetY.toFixed(0)}`);

      // Validar que el rostro tenga suficiente calidad
      const isValid = faceRegion.confidence > 0.25;
      
      if (isValid) {
        console.log(`✅ Rostro detectado - Confianza: ${(faceRegion.confidence * 100).toFixed(0)}% - Centro: (${faceRegion.centerX.toFixed(0)}, ${faceRegion.centerY.toFixed(0)})`);
        return faceRegion;
      } else {
        console.log(`⚠️ Rostro con baja confianza: ${(faceRegion.confidence * 100).toFixed(0)}%`);
        return null;
      }
    } catch (error) {
      console.error('Error detectando rostro:', error);
      return null;
    }
  }

  /**
   * Detecta si hay un rostro COMPLETO en el frame actual (versión boolean legacy)
   */
  private detectFaceInFrame(): boolean {
    const result = this.detectFaceInFrameWithPosition();
    return result !== null;
  }

  /**
   * Busca la región donde está el rostro escaneando el frame
   * VERSIÓN OPTIMIZADA: Grid 2x2 en área central ampliada
   */
  private findFaceRegion(ctx: CanvasRenderingContext2D, width: number, height: number): { centerX: number; centerY: number; confidence: number } | null {
    // Escanear grid 2x2 en zona central ampliada (70% del frame para capturar movimientos laterales)
    const centerW = width * 0.7;
    const centerH = height * 0.7;
    const startX = width * 0.15;
    const startY = height * 0.15;
    
    let totalScore = 0;
    let validPoints = 0;
    let weightedX = 0;
    let weightedY = 0;
    const scores: number[] = [];

    // Grid 2x2 = 4 puntos
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = startX + (centerW / 2) * col + centerW / 4;
        const y = startY + (centerH / 2) * row + centerH / 4;
        
        const score = this.quickEvaluatePoint(ctx, x, y);
        scores.push(score);
        
        if (score > 0.15) {
          totalScore += score;
          validPoints++;
          weightedX += x * score;
          weightedY += y * score;
        }
      }
    }

    console.log(`🔍 Grid scores: [${scores.map(s => s.toFixed(2)).join(', ')}] - Total: ${totalScore.toFixed(2)}, Válidos: ${validPoints}/4`);

    if (validPoints === 0 || totalScore < 0.4) {
      console.log(`⛔ Rechazo: validPoints=${validPoints}, totalScore=${totalScore.toFixed(2)}`);
      return null;
    }

    const bestX = weightedX / totalScore;
    const bestY = weightedY / totalScore;
    const avgScore = totalScore / validPoints;

    return {
      centerX: bestX,
      centerY: bestY,
      confidence: Math.min(avgScore, 1)
    };
  }

  /**
   * Evaluación rápida de un punto (optimizado para velocidad)
   */
  private quickEvaluatePoint(ctx: CanvasRenderingContext2D, x: number, y: number): number {
    try {
      const sampleSize = 30; // Balance entre velocidad (20) y precisión (40)
      const imageData = ctx.getImageData(
        Math.max(0, x - sampleSize / 2),
        Math.max(0, y - sampleSize / 2),
        Math.min(sampleSize, ctx.canvas.width - x + sampleSize / 2),
        Math.min(sampleSize, ctx.canvas.height - y + sampleSize / 2)
      );

      const pixels = imageData.data;
      let totalBrightness = 0;
      let skinToneCount = 0;
      let validPixels = 0;
      const pixelCount = pixels.length / 4;

      // Una sola pasada por los píxeles
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        const brightness = (r + g + b) / 3;
        
        // Solo considerar píxeles con brillo razonable
        if (brightness > 40 && brightness < 240) {
          totalBrightness += brightness;
          validPixels++;
          
          // Detección mejorada de tono de piel
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10) {
            skinToneCount++;
          }
        }
      }

      if (validPixels === 0) {
        return 0;
      }

      const avgBrightness = totalBrightness / validPixels;
      const skinRatio = skinToneCount / validPixels;

      // Score ponderado
      let score = 0;

      // Brillo adecuado (40%)
      if (avgBrightness > 60 && avgBrightness < 200) {
        score += 0.4;
      } else if (avgBrightness > 50 && avgBrightness < 220) {
        score += 0.2; // Rango más amplio con menor peso
      }

      // Tono de piel detectado (60%)
      score += skinRatio * 0.6;

      return score;
    } catch (error) {
      console.debug('Error evaluando punto:', error);
      return 0;
    }
  }

  /**
   * Captura un frame del video
   */
  private captureFrame(position: FacePosition): void {
    try {
      const video = this.videoElement?.nativeElement;
      const canvas = this.canvasElement?.nativeElement;
      
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Configurar canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capturar frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convertir a DataURL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      this.state.capturedFrames.push({
        dataUrl,
        timestamp: Date.now(),
        position
      });

      console.log(`Frame capturado: ${position}`);
    } catch (error) {
      console.error('Error capturando frame:', error);
    }
  }

  /**
   * Limpia el contador (legacy - ya no se usa pero se mantiene por compatibilidad)
   */
  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  /**
   * Procesa la captura y selecciona el mejor frame
   */
  private processCapture(): void {
    this.stopCamera();
    this.state.currentStep = 'PROCESSING';
    this.state.instruction = 'Procesando captura...';
    this.state.isCapturing = false;

    // Seleccionar el frame central como imagen final
    const centerFrame = this.state.capturedFrames.find(f => f.position === 'center');
    
    if (centerFrame) {
      this.state.finalImage = centerFrame.dataUrl;
      this.state.currentStep = 'COMPLETE';
      this.state.instruction = '✅ Selfie capturada exitosamente';
    } else {
      this.state.error = 'No se pudo capturar la selfie';
      this.state.currentStep = 'ERROR';
    }
  }

  /**
   * Confirma y envía la foto capturada
   */
  confirmPhoto(): void {
    if (this.state.finalImage) {
      this.photoTaken.emit(this.state.finalImage);
      this.close();
    }
  }

  /**
   * Reintenta la captura
   */
  retryCapture(): void {
    this.resetState();
  }

  /**
   * Resetea el estado del componente
   */
  private resetState(): void {
    this.state = {
      currentStep: 'READY',
      stepIndex: 0,
      totalSteps: 3,
      instruction: 'Presiona "Iniciar" para comenzar',
      countdown: 0,
      isCapturing: false,
      capturedFrames: [],
      finalImage: null,
      error: null,
      faceDetected: false,
      faceStableTime: 0,
      requiredStableTime: 3000,
      faceAbsentTime: 0,
      gracePeriod: 800,
      ovalOffsetX: 0,
      ovalOffsetY: 0,
      initialFaceX: null,
      headTurnDetected: false
    };
  }

  /**
   * Calcula el progreso del proceso
   */
  get progress(): number {
    return (this.state.stepIndex / this.state.totalSteps);
  }
}
