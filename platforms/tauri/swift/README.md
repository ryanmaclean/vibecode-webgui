# VibeMLAccelerator

High-performance Metal and Core ML acceleration for VibeCode on Apple Silicon.

## Features

- ⚡ **GPU-Accelerated Inference**: Metal compute shaders for embeddings and vector search
- 🧠 **Core ML Integration**: On-device LLM inference with ANE targeting
- 📊 **Performance**: <50ms embeddings, <100ms first token, <10ms vector search
- 🔋 **Power Efficient**: <10W power consumption with Neural Engine
- 💾 **Memory Optimized**: Smart caching and buffer pooling

## Architecture

```
┌─────────────────────────────────────────────────┐
│          VibeMLAccelerator (Swift API)          │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │ ModelManager │  │ CoreMLInferenceEngine│    │
│  └──────┬───────┘  └──────┬───────────────┘    │
│         │                  │                     │
│         └──────┬───────────┘                     │
│                ▼                                 │
│  ┌──────────────────────────────────────┐       │
│  │      MetalAccelerator                │       │
│  │  ┌────────┐  ┌────────┐  ┌────────┐ │       │
│  │  │Embedding│ │Vector  │ │Matrix  │ │       │
│  │  │Kernels │  │Search  │  │Ops     │ │       │
│  │  └────────┘  └────────┘  └────────┘ │       │
│  └──────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Metal Shaders (.metal)│
          │  ┌────────────────┐   │
          │  │GPU Kernels     │   │
          │  └────────────────┘   │
          └──────────────────────┘
```

## Quick Start

### Building

```bash
cd src-tauri/swift
swift build -c release
```

### Testing

```bash
swift test
```

### Using from Swift

```swift
import VibeMLAccelerator

// Initialize
let accelerator = VibeMLAccelerator.shared

// Generate embedding
let embedding = try await accelerator.generateEmbedding(
    text: "Hello, world!",
    model: "all-minilm-l6-v2"
)

// Vector search
let results = try await accelerator.vectorSearch(
    query: queryVector,
    vectors: documentVectors,
    topK: 10
)

// Generate text
accelerator.generateText(
    prompt: "Write a function to calculate fibonacci:",
    model: "mistral-7b-int8",
    options: InferenceOptions(maxTokens: 100)
) { token in
    print(token, terminator: "")
} onComplete: { metrics in
    print("\\nGenerated \\(metrics.totalTokens) tokens in \\(metrics.totalDuration)s")
} onError: { error in
    print("Error: \\(error)")
}
```

### Using from Rust (via FFI)

```rust
// src-tauri/src/ml.rs
#[link(name = "VibeMLAccelerator")]
extern "C" {
    fn vibe_ml_init() -> *mut c_void;
    fn vibe_ml_is_available() -> bool;
    fn vibe_ml_get_device_info() -> *const c_char;
}

#[tauri::command]
async fn ml_is_available() -> bool {
    unsafe { vibe_ml_is_available() }
}
```

## Performance Targets

| Operation | Target | Hardware |
|-----------|--------|----------|
| Embedding (512 tokens) | <50ms | Metal GPU |
| Vector Search (1K) | <10ms | Metal GPU |
| First Token (small) | <100ms | ANE |
| First Token (large) | <2s | GPU |
| Throughput | 10-20 tok/s | ANE/GPU |
| Power | <10W | ANE |

## Hardware Requirements

- **Minimum**: M1 (Apple Silicon)
- **Recommended**: M2 or later
- **macOS**: 13.0+ (Ventura)
- **Memory**: 8GB+ (16GB recommended)
- **Storage**: 5GB+ for models

## Supported Models

### Embeddings
- **all-minilm-l6-v2** (80MB) - Fast, ANE-optimized
- **all-mpnet-base-v2** (420MB) - Higher quality

### Text Generation
- **mistral-7b-int8** (4.5GB) - General purpose
- **llama-3-8b-int4** (4.2GB) - Code generation
- **qwen-2.5-coder-7b-int8** (4.8GB) - Code completion

## Components

### MLTypes.swift
Core type definitions, configurations, and error handling.

### MetalAccelerator.swift
GPU compute kernels for:
- Embedding generation
- Vector similarity search
- Matrix operations
- Activation functions

### ModelManager.swift
Model lifecycle management:
- Async loading with caching
- Hardware selection (ANE/GPU/CPU)
- Memory management
- Model compilation

### CoreMLEngine.swift
Core ML inference engine:
- Streaming text generation
- Embedding generation
- Token sampling (temperature, top-p, top-k)
- Metrics collection

### Shaders.metal
Metal compute shaders:
- `generate_embedding`: Parallel embedding computation
- `cosine_similarity_batch`: Batch similarity search
- `matrix_multiply`: Optimized GEMM
- `layer_norm`, `softmax`: Normalization layers
- `attention_scores`: Multi-head attention
- `quantize/dequantize`: INT8/INT4 support

## Development

### Adding New Models

1. Convert using coremltools:
```python
import coremltools as ct
from transformers import AutoModel

model = AutoModel.from_pretrained("model-name")
mlmodel = ct.convert(
    model,
    inputs=[ct.TensorType(name="input_ids", shape=(1, 512))],
    compute_units=ct.ComputeUnit.ALL
)
mlmodel.save("model-name.mlpackage")
```

2. Compile for ANE:
```bash
xcrun coremlcompiler compile model-name.mlpackage model-name.mlmodelc
```

3. Place in cache directory:
```bash
cp -r model-name.mlmodelc ~/Library/Caches/VibeMLModels/
```

### Adding New Kernels

1. Add kernel to `Shaders.metal`:
```metal
kernel void my_kernel(
    const device float* input [[buffer(0)]],
    device float* output [[buffer(1)]],
    uint gid [[thread_position_in_grid]]
) {
    // Implementation
}
```

2. Add pipeline in `MetalAccelerator.swift`:
```swift
private func initializePipelines() throws {
    if let myFunction = library.makeFunction(name: "my_kernel") {
        self.myPipeline = try device.makeComputePipelineState(function: myFunction)
    }
}
```

3. Add public method:
```swift
public func myOperation(input: [Float]) async throws -> [Float] {
    // Use myPipeline
}
```

## Testing

### Unit Tests
```bash
swift test --filter VibeMLAcceleratorTests
```

### Performance Tests
```bash
swift test --filter PerformanceBenchmarks
```

### Integration Tests
```bash
# From Rust
cargo test ml_
```

## Troubleshooting

### Model Not Found
```
Error: Model not found: model-name
```
**Solution**: Check model cache at `~/Library/Caches/VibeMLModels/`

### Metal Not Available
```
Error: Metal device not available
```
**Solution**: Only works on Apple Silicon Macs (M1+)

### Out of Memory
```
Error: Memory error: Failed to allocate buffer
```
**Solution**:
- Unload unused models: `accelerator.unloadModel(name:)`
- Use smaller models or INT4 quantization
- Close other applications

### Slow Inference
**Check compute device**:
```swift
let info = accelerator.getDeviceInfo()
print(info)
```

**Optimize**:
- Use ANE for small models (<2B parameters)
- Use GPU for large models
- Enable INT8/INT4 quantization
- Reduce context length

## License

MIT

## Credits

Built by Agent 29 (Staff ML Engineer, Former Apple Core ML Team) for VibeCode.

## References

- [Core ML Documentation](https://developer.apple.com/documentation/coreml)
- [Metal Shading Language](https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf)
- [Metal Performance Shaders](https://developer.apple.com/documentation/metalperformanceshaders)
- [Neural Engine Guide](https://github.com/hollance/neural-engine)
