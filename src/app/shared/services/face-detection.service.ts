/**
 * Face Detection Service
 * Uses TensorFlow.js with FaceMesh to detect faces locally on the device
 * before uploading to backend for verification
 */

import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as facemesh from '@tensorflow-models/facemesh';

export interface FaceDetectionResult {
  hasFace: boolean;
  faceCount: number;
  confidence: number;
  landmarks?: Array<number[]>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService {
  private facemeshModel: facemesh.FaceMesh | null = null;
  private modelLoaded = false;
  private modelLoading = false;

  constructor() {}

  /**
   * Initialize FaceMesh model
   * This should be called once when the app starts
   */
  async initializeModel(): Promise<void> {
    if (this.modelLoaded || this.modelLoading) {
      return;
    }

    try {
      this.modelLoading = true;
      // console.log('[FACE_DETECTION] Loading FaceMesh model...');
      
      // Load TensorFlow.js backend
      await tf.ready();
      
      // Load FaceMesh model
      this.facemeshModel = await facemesh.load({
        maxFaces: 5,
        backend: 'webgl' // Use WebGL for better performance
      });
      
      this.modelLoaded = true;
      this.modelLoading = false;
      // console.log('[FACE_DETECTION] FaceMesh model loaded successfully');
    } catch (error) {
      this.modelLoading = false;
      console.error('[FACE_DETECTION] Failed to load model:', error);
      throw new Error(`Failed to load face detection model: ${error}`);
    }
  }

  /**
   * Detect faces in an image
   * @param imageData Can be: HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, or Blob
   * @param minConfidence Minimum confidence threshold (0-1)
   */
  async detectFaces(
    imageData: HTMLImageElement | HTMLCanvasElement | Blob,
    minConfidence: number = 0.7
  ): Promise<FaceDetectionResult> {
    try {
      // Ensure model is loaded
      if (!this.modelLoaded) {
        await this.initializeModel();
      }

      if (!this.facemeshModel) {
        return {
          hasFace: false,
          faceCount: 0,
          confidence: 0,
          error: 'Face detection model not available'
        };
      }

      // Convert Blob to HTMLImageElement if needed
      let imageElement = imageData;
      if (imageData instanceof Blob) {
        imageElement = await this.blobToImageElement(imageData);
      }

      // Run prediction
      // console.log('[FACE_DETECTION] Running face detection...');
      const predictions = await this.facemeshModel.estimateFaces(imageElement as any, false);
      
      // console.log(`[FACE_DETECTION] Detected ${predictions.length} face(s)`);

      if (predictions.length === 0) {
        return {
          hasFace: false,
          faceCount: 0,
          confidence: 0,
          error: 'No face detected in the image'
        };
      }

      // Get the face with highest confidence (first detected face)
      const face = predictions[0];
      
      // Calculate confidence score (0-100)
      // FaceMesh provides landmarks, we'll use the presence and quality of landmarks
      // as a confidence indicator
      const landmarkCount = face.landmarks.length;
      const expectedLandmarks = 468; // FaceMesh uses 468 landmarks
      const confidence = Math.round((landmarkCount / expectedLandmarks) * 100);

      // Calculate bounding box
      const landmarks = face.landmarks as number[][];
      const xs = landmarks.map(l => l[0]);
      const ys = landmarks.map(l => l[1]);
      
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const result: FaceDetectionResult = {
        hasFace: true,
        faceCount: predictions.length,
        confidence: confidence,
        landmarks: landmarks,
        boundingBox: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      };

      // console.log('[FACE_DETECTION] Detection result:', result);
      return result;

    } catch (error) {
      console.error('[FACE_DETECTION] Error during face detection:', error);
      return {
        hasFace: false,
        faceCount: 0,
        confidence: 0,
        error: `Face detection failed: ${error}`
      };
    }
  }

  /**
   * Validate if a face is present and meets minimum quality requirements
   * @param imageData Image to validate
   * @param minConfidence Minimum confidence threshold (0-100)
   */
  async validateFaceQuality(
    imageData: HTMLImageElement | HTMLCanvasElement | Blob,
    minConfidence: number = 70
  ): Promise<{ isValid: boolean; message: string; confidence: number }> {
    const result = await this.detectFaces(
      imageData,
      minConfidence / 100
    );

    if (!result.hasFace) {
      return {
        isValid: false,
        message: result.error || 'No face detected',
        confidence: 0
      };
    }

    if (result.confidence < minConfidence) {
      return {
        isValid: false,
        message: `Face quality too low (${result.confidence}%). Please try again with better lighting.`,
        confidence: result.confidence
      };
    }

    if (result.faceCount > 1) {
      return {
        isValid: false,
        message: 'Multiple faces detected. Please ensure only one face is visible.',
        confidence: result.confidence
      };
    }

    return {
      isValid: true,
      message: 'Face detected successfully',
      confidence: result.confidence
    };
  }

  /**
   * Convert Blob to HTMLImageElement
   */
  private blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
      img.crossOrigin = 'anonymous';
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.facemeshModel) {
      this.facemeshModel.dispose();
      this.facemeshModel = null;
      this.modelLoaded = false;
    }
    tf.disposeVariables();
  }

  /**
   * Check if model is ready
   */
  isModelReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Check if model is currently loading
   */
  isModelLoading(): boolean {
    return this.modelLoading;
  }
}
