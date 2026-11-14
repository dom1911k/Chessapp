// Runs Maia-3 (ONNX) off the main thread with onnxruntime-web (WebAssembly build with SIMD).
import * as ort from 'onnxruntime-web/wasm';
import { handle } from './runner';

self.onmessage = (e) => void handle(ort as unknown as typeof import('onnxruntime-web'), e.data, 'wasm');
