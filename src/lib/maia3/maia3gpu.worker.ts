// Maia-3 with the WebGPU build of onnxruntime-web (falls back to wasm inside the same build).
import * as ort from 'onnxruntime-web/webgpu';
import { handle } from './runner';

self.onmessage = (e) => void handle(ort as unknown as typeof import('onnxruntime-web'), e.data, 'webgpu');
