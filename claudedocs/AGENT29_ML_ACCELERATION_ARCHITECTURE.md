# Agent 29: Apple Silicon ML Acceleration Architecture

**Agent**: Staff ML Engineer (Former Apple Core ML Team)
**Date**: 2025-10-02
**Mission**: Accelerate AI agent inference using Apple Silicon hardware

## Executive Summary

Implementation plan for Metal/Core ML acceleration layer providing <100ms inference latency for small models and <2s for large models, with <10W power consumption for on-device AI inference.

## Current State Assessment

### Existing Infrastructure
- **Ollama Integration**: `/src/app/api/ollama/models/route.ts` - Model management API
- **Local Embeddings**: `/src/lib/ai/localEmbedding.ts` - Basic hash-based embeddings
- **Tauri App**: `/src-tauri/` - Rust-based native integration layer
- **Vector DB**: Multiple adapters (Postgres, Redis, Weaviate)
- **AI Services**: OpenAI, HuggingFace, Azure integrations

### Gaps Identified
1. **No Metal acceleration** - CPU-only inference
2. **No Core ML models** - Relying on external APIs or Ollama
3. **No ANE targeting** - Missing Neural Engine optimization
4. **No on-device vector search** - All vector ops on CPU
5. **No model caching** - No optimized model management

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    TypeScript/Next.js Layer                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Inference   │  │ Embedding    │  │ Vector       │      │
│  │ API         │  │ API          │  │ Search API   │      │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          │ XPC/IPC        │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Swift Native Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ML Manager  │  │ Metal        │  │ Core ML      │      │
│  │             │  │ Accelerator  │  │ Engine       │      │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         └─────────┬───────┴──────────────────┘              │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │          Hardware Abstraction Layer             │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │      │
│  │  │ Neural   │  │ GPU      │  │ CPU      │      │      │
│  │  │ Engine   │  │ (Metal)  │  │ Fallback │      │      │
│  │  └──────────┘  └──────────┘  └──────────┘      │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Swift Bridge Layer (Week 1)
**Location**: `/src-tauri/swift/` (new)

1. **Swift Package Structure**
   ```
   src-tauri/swift/
   ├── Package.swift
   ├── Sources/
   │   ├── VibeMLAccelerator/
   │   │   ├── MLManager.swift
   │   │   ├── MetalAccelerator.swift
   │   │   ├── CoreMLEngine.swift
   │   │   ├── ModelManager.swift
   │   │   └── XPCBridge.swift
   │   └── MetalShaders/
   │       ├── EmbeddingKernel.metal
   │       ├── VectorSearch.metal
   │       └── MatrixOps.metal
   └── Tests/
   ```

2. **Rust-Swift Interop**
   - Update `src-tauri/Cargo.toml` with Swift bindings
   - Create XPC service for Swift process isolation
   - Implement async message passing

### Phase 2: Metal Compute Shaders (Week 1-2)

#### 2.1 Embedding Generation
**File**: `MetalShaders/EmbeddingKernel.metal`

```metal
#include <metal_stdlib>
using namespace metal;

// Fast embedding generation using Metal compute
kernel void generate_embedding(
    const device char* text [[buffer(0)]],
    device float* embeddings [[buffer(1)]],
    constant uint& text_length [[buffer(2)]],
    constant uint& embedding_dim [[buffer(3)]],
    uint gid [[thread_position_in_grid]]
) {
    // Parallel embedding computation
    // 10-50x faster than CPU
}
```

#### 2.2 Vector Similarity Search
**File**: `MetalShaders/VectorSearch.metal`

```metal
kernel void cosine_similarity_batch(
    const device float* query [[buffer(0)]],
    const device float* vectors [[buffer(1)]],
    device float* similarities [[buffer(2)]],
    constant uint& vector_count [[buffer(3)]],
    constant uint& dimension [[buffer(4)]],
    uint gid [[thread_position_in_grid]]
) {
    // GPU-accelerated similarity search
    // Process 1000+ vectors in <5ms
}
```

### Phase 3: Core ML Model Integration (Week 2-3)

#### 3.1 Model Conversion Pipeline
**File**: `Scripts/convert_to_coreml.py`

```python
import coremltools as ct
from transformers import AutoModel, AutoTokenizer

def convert_llm_to_coreml(model_name: str, quantization: str = "int8"):
    """
    Convert HuggingFace models to Core ML
    Supports: Llama 3, Mistral, Qwen, etc.
    """
    model = AutoModel.from_pretrained(model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    # Convert with Neural Engine targeting
    mlmodel = ct.convert(
        model,
        inputs=[ct.TensorType(name="input_ids", shape=(1, 512))],
        compute_units=ct.ComputeUnit.ALL  # CPU + GPU + ANE
    )

    # Quantize for efficiency
    if quantization == "int8":
        mlmodel = ct.compression.affine.quantize_weights(mlmodel, mode="linear")
    elif quantization == "int4":
        mlmodel = ct.compression.affine.quantize_weights(mlmodel, mode="linear", nbits=4)

    return mlmodel
```

#### 3.2 Model Management
**File**: `Sources/VibeMLAccelerator/ModelManager.swift`

```swift
import CoreML
import Combine

class ModelManager: ObservableObject {
    @Published var availableModels: [MLModel] = []
    @Published var loadedModels: [String: MLModel] = [:]

    private let modelCache: ModelCache
    private let downloadManager: ModelDownloadManager

    func loadModel(name: String, quantization: QuantizationType) async throws -> MLModel {
        // Check cache first
        if let cached = modelCache.get(name) {
            return cached
        }

        // Download if needed
        let modelURL = try await downloadManager.download(name, quantization: quantization)

        // Compile for ANE
        let compiledURL = try await MLModel.compileModel(at: modelURL)

        // Load with configuration
        let config = MLModelConfiguration()
        config.computeUnits = .all  // Use ANE + GPU
        config.allowLowPrecisionAccumulationOnGPU = true

        let model = try MLModel(contentsOf: compiledURL, configuration: config)

        // Cache for reuse
        modelCache.set(name, model: model)
        loadedModels[name] = model

        return model
    }
}
```

### Phase 4: On-Device Inference API (Week 3)

#### 4.1 Swift Inference Engine
**File**: `Sources/VibeMLAccelerator/CoreMLEngine.swift`

```swift
import CoreML
import NaturalLanguage

class CoreMLInferenceEngine {
    private let modelManager: ModelManager
    private let tokenizer: Tokenizer

    func generateText(
        prompt: String,
        model: String = "mistral-7b-int8",
        maxTokens: Int = 512,
        temperature: Float = 0.7
    ) async throws -> AsyncStream<String> {
        let mlModel = try await modelManager.loadModel(name: model)

        return AsyncStream { continuation in
            Task {
                let tokens = tokenizer.encode(prompt)
                var generatedTokens: [Int] = []

                for _ in 0..<maxTokens {
                    // Prepare input
                    let input = MLMultiArray(shape: [1, NSNumber(value: tokens.count)], dataType: .int32)
                    // ... populate input

                    // Inference on ANE/GPU
                    let output = try mlModel.prediction(from: MLDictionaryFeatureProvider(dictionary: ["input_ids": input]))

                    // Sample next token
                    let logits = output.featureValue(for: "logits")!.multiArrayValue!
                    let nextToken = sample(logits, temperature: temperature)

                    generatedTokens.append(nextToken)

                    // Stream token
                    let tokenStr = tokenizer.decode([nextToken])
                    continuation.yield(tokenStr)

                    // Check for EOS
                    if nextToken == tokenizer.eosTokenId {
                        break
                    }
                }

                continuation.finish()
            }
        }
    }

    func generateEmbedding(text: String, model: String = "all-minilm-l6-v2") async throws -> [Float] {
        let mlModel = try await modelManager.loadModel(name: model)

        // Tokenize
        let tokens = tokenizer.encode(text)
        let input = createMLArrayInput(tokens)

        // Run inference
        let output = try mlModel.prediction(from: input)
        let embedding = output.featureValue(for: "embeddings")!.multiArrayValue!

        return embedding.toFloatArray()
    }
}
```

#### 4.2 TypeScript API Bridge
**File**: `src/lib/ml/metal-accelerator.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface InferenceOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export class MetalAccelerator {
  private static instance: MetalAccelerator;

  private constructor() {}

  static getInstance(): MetalAccelerator {
    if (!this.instance) {
      this.instance = new MetalAccelerator();
    }
    return this.instance;
  }

  async generateText(prompt: string, options: InferenceOptions): Promise<AsyncGenerator<string>> {
    const stream = await invoke<number>('ml_generate_text', {
      prompt,
      options: {
        model: options.model || 'mistral-7b-int8',
        maxTokens: options.maxTokens || 512,
        temperature: options.temperature || 0.7,
      }
    });

    return this.createTokenStream(stream);
  }

  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    return invoke<number[]>('ml_generate_embedding', {
      text,
      model: options?.model || 'all-minilm-l6-v2',
    });
  }

  async vectorSearch(
    query: number[],
    vectors: number[][],
    topK: number = 10
  ): Promise<Array<{ index: number; similarity: number }>> {
    return invoke<Array<{ index: number; similarity: number }>>('ml_vector_search', {
      query,
      vectors,
      topK,
    });
  }

  async listModels(): Promise<Array<{ name: string; size: number; quantization: string }>> {
    return invoke('ml_list_models');
  }

  async downloadModel(name: string, quantization: 'int8' | 'int4' = 'int8'): Promise<void> {
    return invoke('ml_download_model', { name, quantization });
  }

  private async *createTokenStream(streamId: number): AsyncGenerator<string> {
    while (true) {
      const token = await invoke<string | null>('ml_read_token', { streamId });
      if (token === null) break;
      yield token;
    }
  }
}

// Export singleton
export const metalAccelerator = MetalAccelerator.getInstance();
```

### Phase 5: Performance Optimization (Week 4)

#### 5.1 Hardware Selection Strategy
**File**: `Sources/VibeMLAccelerator/HardwareSelector.swift`

```swift
enum ComputeDevice {
    case neuralEngine
    case gpu
    case cpu
}

class HardwareSelector {
    func selectOptimalDevice(for model: String, inputSize: Int) -> ComputeDevice {
        let device = MTLCreateSystemDefaultDevice()!

        // ANE: Best for <2B parameter models, batch size 1
        if isANECompatible(model) && inputSize < 512 {
            return .neuralEngine
        }

        // GPU: Best for larger models or batch inference
        if device.supportsFamily(.apple8) { // M2+
            return .gpu
        }

        // CPU: Fallback
        return .cpu
    }

    private func isANECompatible(_ model: String) -> Bool {
        // ANE constraints:
        // - FP16 or quantized ops only
        // - Fixed input shapes
        // - Limited operator support
        let aneCompatibleModels = [
            "all-minilm-l6-v2",
            "mistral-7b-int8",
            "llama-3-8b-int4"
        ]
        return aneCompatibleModels.contains(model)
    }
}
```

#### 5.2 Memory Management
**File**: `Sources/VibeMLAccelerator/MemoryManager.swift`

```swift
class MemoryManager {
    private let metalDevice: MTLDevice
    private var bufferPool: [String: MTLBuffer] = [:]

    func allocateBuffer(size: Int, label: String) -> MTLBuffer {
        // Check pool first
        if let pooled = bufferPool[label] {
            return pooled
        }

        // Allocate from Metal heap
        let buffer = metalDevice.makeBuffer(
            length: size,
            options: [.storageModeShared, .cpuCacheModeWriteCombined]
        )!
        buffer.label = label

        // Add to pool
        bufferPool[label] = buffer

        return buffer
    }

    func purgeUnusedBuffers() {
        // Release buffers not accessed in 5 minutes
        let cutoff = Date().addingTimeInterval(-300)
        bufferPool = bufferPool.filter { $0.value.lastAccess > cutoff }
    }
}
```

### Phase 6: Benchmarking & Validation (Week 4)

#### 6.1 Benchmark Suite
**File**: `Tests/PerformanceBenchmarks.swift`

```swift
import XCTest

class PerformanceBenchmarks: XCTestCase {
    var engine: CoreMLInferenceEngine!

    func testEmbeddingLatency() async throws {
        let text = "This is a test sentence for embedding generation."

        measure(metrics: [XCTClockMetric()]) {
            _ = try! await engine.generateEmbedding(text: text)
        }

        // Assert: <50ms for embedding generation
        XCTAssertLessThan(measurementDuration, 0.05)
    }

    func testInferenceLatency() async throws {
        let prompt = "Write a function to calculate fibonacci:"

        measure(metrics: [XCTClockMetric()]) {
            var tokens = 0
            for await _ in try! await engine.generateText(prompt: prompt, maxTokens: 100) {
                tokens += 1
            }
        }

        // Assert: <2s for 100 tokens
        XCTAssertLessThan(measurementDuration, 2.0)
    }

    func testVectorSearchLatency() async throws {
        let query = Array(repeating: 0.5, count: 768)
        let vectors = (0..<1000).map { _ in
            Array(repeating: Float.random(in: 0...1), count: 768)
        }

        measure(metrics: [XCTClockMetric()]) {
            _ = try! await engine.vectorSearch(query: query, vectors: vectors, topK: 10)
        }

        // Assert: <10ms for 1000 vector search
        XCTAssertLessThan(measurementDuration, 0.01)
    }

    func testPowerConsumption() async throws {
        // Use IOKit to measure power
        let powerBefore = measurePower()

        // Run inference for 1 minute
        for _ in 0..<60 {
            _ = try await engine.generateEmbedding(text: "test")
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }

        let powerAfter = measurePower()
        let avgPower = (powerAfter - powerBefore) / 60.0

        // Assert: <10W average power
        XCTAssertLessThan(avgPower, 10.0)
    }
}
```

## Integration Points

### 1. Tauri Commands
**File**: `src-tauri/src/ml.rs` (new)

```rust
use tauri::command;

#[command]
pub async fn ml_generate_text(
    prompt: String,
    options: InferenceOptions,
) -> Result<String, String> {
    // Call Swift via XPC
    swift_bridge::ml_generate_text(prompt, options)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn ml_generate_embedding(
    text: String,
    model: String,
) -> Result<Vec<f32>, String> {
    swift_bridge::ml_generate_embedding(text, model)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn ml_vector_search(
    query: Vec<f32>,
    vectors: Vec<Vec<f32>>,
    top_k: usize,
) -> Result<Vec<SearchResult>, String> {
    swift_bridge::ml_vector_search(query, vectors, top_k)
        .await
        .map_err(|e| e.to_string())
}
```

### 2. Next.js API Routes
**File**: `src/app/api/ml/inference/route.ts` (new)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { metalAccelerator } from '@/lib/ml/metal-accelerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { prompt, options } = await request.json();

    // Use Metal acceleration if available (macOS only)
    if (process.platform === 'darwin') {
      const stream = await metalAccelerator.generateText(prompt, options);

      // Return SSE stream
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          for await (const token of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
          controller.close();
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Fallback to Ollama
    return NextResponse.json({ error: 'Metal acceleration not available' }, { status: 503 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

### 3. React Integration
**File**: `src/hooks/useMetalInference.ts` (new)

```typescript
import { useState, useCallback } from 'react';
import { metalAccelerator } from '@/lib/ml/metal-accelerator';

export function useMetalInference() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateText = useCallback(async (
    prompt: string,
    onToken: (token: string) => void
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await metalAccelerator.generateText(prompt, {
        model: 'mistral-7b-int8',
        maxTokens: 512,
      });

      for await (const token of stream) {
        onToken(token);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateEmbedding = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);

    try {
      return await metalAccelerator.generateEmbedding(text);
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { generateText, generateEmbedding, isLoading, error };
}
```

## Performance Targets

### Latency
- **Embedding Generation**: <50ms for 512 tokens
- **Small Model Inference** (<1B params): <100ms first token, 20 tokens/sec
- **Large Model Inference** (7B+ params): <2s first token, 10 tokens/sec
- **Vector Search** (1K vectors): <10ms

### Power Consumption
- **Idle**: <0.5W
- **Embedding**: <5W
- **Inference**: <10W average

### Memory
- **Model Cache**: <4GB for 3 models
- **Runtime**: <2GB per inference session
- **Metal Buffers**: <500MB

## Model Repository

### Recommended Models
1. **all-minilm-l6-v2** (80MB) - Fast embeddings, ANE-optimized
2. **mistral-7b-int8** (4.5GB) - General purpose chat, GPU-optimized
3. **llama-3-8b-int4** (4.2GB) - Code generation, ANE-compatible
4. **qwen-2.5-coder-7b-int8** (4.8GB) - Code completion

### Conversion Pipeline
```bash
# Convert HuggingFace model to Core ML
python scripts/convert_to_coreml.py \
  --model mistralai/Mistral-7B-Instruct-v0.2 \
  --quantization int8 \
  --output models/mistral-7b-int8.mlpackage

# Optimize for ANE
xcrun coremlcompiler compile \
  models/mistral-7b-int8.mlpackage \
  models/mistral-7b-int8.mlmodelc \
  --compute-units ALL
```

## Testing Strategy

### Unit Tests
- Metal kernel correctness
- Model loading/unloading
- Memory management
- Hardware selection logic

### Integration Tests
- Tauri <-> Swift IPC
- TypeScript API calls
- Streaming inference
- Concurrent requests

### Performance Tests
- Latency benchmarks
- Power consumption
- Memory usage
- Thermal throttling

### Platform Tests
- M1/M2/M3 compatibility
- macOS 13/14/15 support
- Offline operation
- Fallback behavior

## Rollout Plan

### Week 1: Foundation
- [ ] Swift package setup
- [ ] Rust-Swift bridge
- [ ] Basic Metal shaders
- [ ] TypeScript API skeleton

### Week 2: Core ML
- [ ] Model conversion pipeline
- [ ] Model manager implementation
- [ ] Inference engine
- [ ] Embedding generation

### Week 3: Integration
- [ ] Tauri commands
- [ ] Next.js API routes
- [ ] React hooks
- [ ] Error handling

### Week 4: Optimization
- [ ] Hardware selection
- [ ] Memory optimization
- [ ] Benchmarking
- [ ] Documentation

## Success Metrics

- [ ] <100ms embedding latency
- [ ] <2s inference for 100 tokens
- [ ] <10W power consumption
- [ ] 100% offline operation
- [ ] 90% test coverage
- [ ] Zero production crashes

## Dependencies

### Swift Packages
- CoreML
- Metal
- Accelerate
- NaturalLanguage

### Python (Development)
- coremltools>=7.0
- transformers>=4.30
- torch>=2.0

### Rust Crates
- swift-bridge
- tokio
- serde

## Risk Mitigation

1. **ANE Incompatibility**: Fallback to GPU/CPU
2. **Memory Pressure**: Aggressive caching, model unloading
3. **Thermal Throttling**: Dynamic quality adjustment
4. **Model Conversion Failures**: Pre-converted model repository
5. **API Changes**: Version pinning, compatibility layer

## Documentation Deliverables

1. API Reference (`docs/ml/API.md`)
2. Model Conversion Guide (`docs/ml/MODELS.md`)
3. Performance Tuning (`docs/ml/PERFORMANCE.md`)
4. Troubleshooting (`docs/ml/TROUBLESHOOTING.md`)
5. Architecture Deep Dive (`docs/ml/ARCHITECTURE.md`)

---

**Status**: Architecture Complete, Ready for Implementation
**Next**: Begin Phase 1 - Swift Bridge Layer
