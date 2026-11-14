// Runs Maia-3 (ONNX) off the main thread with onnxruntime-web. This worker uses the plain
// WebAssembly build (SIMD); maia3gpu.worker.ts is the same with the WebGPU build.
import * as ort from 'onnxruntime-web/wasm';
import { handle } from './runner';

self.onmessage = (e) => void handle(ort as unknown as typeof import('onnxruntime-web'), e.data, 'wasm');
