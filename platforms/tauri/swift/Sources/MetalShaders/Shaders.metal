#include <metal_stdlib>
using namespace metal;

// MARK: - Embedding Generation

/// Fast embedding generation using GPU parallelization
/// Implements a simple but effective token-based embedding approach
kernel void generate_embedding(
    const device int* tokens [[buffer(0)]],
    device float* embeddings [[buffer(1)]],
    constant uint& token_count [[buffer(2)]],
    constant uint& embedding_dim [[buffer(3)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= embedding_dim) return;

    float value = 0.0;

    // Hash each token and accumulate into embedding dimension
    for (uint i = 0; i < token_count; i++) {
        uint hash = (uint(tokens[i]) * 31) + gid;
        hash = hash ^ (hash >> 16);
        hash = hash * 0x85ebca6b;
        hash = hash ^ (hash >> 13);
        hash = hash * 0xc2b2ae35;
        hash = hash ^ (hash >> 16);

        // Map hash to [-1, 1] range
        float normalized = (float(hash) / float(UINT_MAX)) * 2.0 - 1.0;
        value += normalized;
    }

    // Average and store
    embeddings[gid] = value / float(token_count);
}

// MARK: - Vector Similarity

/// GPU-accelerated cosine similarity computation
/// Processes multiple vectors in parallel for fast search
kernel void cosine_similarity_batch(
    const device float* query [[buffer(0)]],
    const device float* vectors [[buffer(1)]],
    device float* similarities [[buffer(2)]],
    constant uint& vector_count [[buffer(3)]],
    constant uint& dimension [[buffer(4)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= vector_count) return;

    const device float* vector = vectors + (gid * dimension);

    // Compute dot product and norms
    float dot_product = 0.0;
    float query_norm = 0.0;
    float vector_norm = 0.0;

    for (uint i = 0; i < dimension; i++) {
        float q = query[i];
        float v = vector[i];

        dot_product += q * v;
        query_norm += q * q;
        vector_norm += v * v;
    }

    // Compute cosine similarity
    float norm_product = sqrt(query_norm * vector_norm);
    similarities[gid] = (norm_product > 0.0) ? (dot_product / norm_product) : 0.0;
}

// MARK: - Matrix Operations

/// Optimized matrix multiplication kernel
/// Used for transformer attention and feed-forward layers
kernel void matrix_multiply(
    const device float* matrixA [[buffer(0)]],
    const device float* matrixB [[buffer(1)]],
    device float* matrixC [[buffer(2)]],
    constant uint& rows_A [[buffer(3)]],
    constant uint& cols_A [[buffer(4)]],
    constant uint& cols_B [[buffer(5)]],
    uint2 gid [[thread_position_in_grid]]
) {
    uint row = gid.y;
    uint col = gid.x;

    if (row >= rows_A || col >= cols_B) return;

    float sum = 0.0;
    for (uint k = 0; k < cols_A; k++) {
        sum += matrixA[row * cols_A + k] * matrixB[k * cols_B + col];
    }

    matrixC[row * cols_B + col] = sum;
}

// MARK: - Activation Functions

/// ReLU activation (in-place)
kernel void relu_inplace(
    device float* data [[buffer(0)]],
    constant uint& count [[buffer(1)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= count) return;
    data[gid] = max(0.0f, data[gid]);
}

/// GELU activation (approximation)
kernel void gelu_inplace(
    device float* data [[buffer(0)]],
    constant uint& count [[buffer(1)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= count) return;

    float x = data[gid];
    // GELU approximation: 0.5 * x * (1 + tanh(sqrt(2/π) * (x + 0.044715 * x^3)))
    float x3 = x * x * x;
    float inner = 0.7978845608f * (x + 0.044715f * x3);
    data[gid] = 0.5f * x * (1.0f + tanh(inner));
}

// MARK: - Normalization

/// Layer normalization
kernel void layer_norm(
    const device float* input [[buffer(0)]],
    device float* output [[buffer(1)]],
    const device float* gamma [[buffer(2)]],
    const device float* beta [[buffer(3)]],
    constant uint& dimension [[buffer(4)]],
    constant float& epsilon [[buffer(5)]],
    uint gid [[thread_position_in_grid]]
) {
    // Compute mean
    float sum = 0.0;
    for (uint i = 0; i < dimension; i++) {
        sum += input[i];
    }
    float mean = sum / float(dimension);

    // Compute variance
    float var_sum = 0.0;
    for (uint i = 0; i < dimension; i++) {
        float diff = input[i] - mean;
        var_sum += diff * diff;
    }
    float variance = var_sum / float(dimension);
    float std_dev = sqrt(variance + epsilon);

    // Normalize and apply affine transformation
    if (gid < dimension) {
        float normalized = (input[gid] - mean) / std_dev;
        output[gid] = gamma[gid] * normalized + beta[gid];
    }
}

// MARK: - Softmax

/// Softmax activation for attention scores
kernel void softmax(
    const device float* input [[buffer(0)]],
    device float* output [[buffer(1)]],
    constant uint& length [[buffer(2)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= length) return;

    // Find max for numerical stability
    float max_val = input[0];
    for (uint i = 1; i < length; i++) {
        max_val = max(max_val, input[i]);
    }

    // Compute exp and sum
    float exp_sum = 0.0;
    for (uint i = 0; i < length; i++) {
        exp_sum += exp(input[i] - max_val);
    }

    // Normalize
    output[gid] = exp(input[gid] - max_val) / exp_sum;
}

// MARK: - Attention

/// Multi-head attention kernel (simplified)
kernel void attention_scores(
    const device float* query [[buffer(0)]],
    const device float* key [[buffer(1)]],
    device float* scores [[buffer(2)]],
    constant uint& seq_length [[buffer(3)]],
    constant uint& head_dim [[buffer(4)]],
    constant float& scale [[buffer(5)]],
    uint2 gid [[thread_position_in_grid]]
) {
    uint i = gid.y;  // Query position
    uint j = gid.x;  // Key position

    if (i >= seq_length || j >= seq_length) return;

    // Compute dot product
    float score = 0.0;
    for (uint d = 0; d < head_dim; d++) {
        score += query[i * head_dim + d] * key[j * head_dim + d];
    }

    // Scale and store
    scores[i * seq_length + j] = score * scale;
}

// MARK: - Token Sampling

/// Top-k sampling kernel
kernel void top_k_filter(
    device float* logits [[buffer(0)]],
    constant uint& vocab_size [[buffer(1)]],
    constant uint& k [[buffer(2)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= vocab_size) return;

    // Simple implementation: set non-top-k logits to -inf
    // In practice, would use more sophisticated parallel sorting
    float threshold = -INFINITY;

    // Find k-th largest value (simplified)
    uint count = 0;
    for (uint i = 0; i < vocab_size; i++) {
        if (logits[i] > logits[gid]) {
            count++;
        }
    }

    // Zero out if not in top-k
    if (count >= k) {
        logits[gid] = -INFINITY;
    }
}

// MARK: - Quantization Support

/// Dequantize int8 weights to float
kernel void dequantize_int8(
    const device char* quantized [[buffer(0)]],
    device float* dequantized [[buffer(1)]],
    constant float& scale [[buffer(2)]],
    constant float& zero_point [[buffer(3)]],
    constant uint& count [[buffer(4)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= count) return;

    float q_value = float(quantized[gid]);
    dequantized[gid] = (q_value - zero_point) * scale;
}

/// Quantize float to int8
kernel void quantize_to_int8(
    const device float* input [[buffer(0)]],
    device char* quantized [[buffer(1)]],
    constant float& scale [[buffer(2)]],
    constant float& zero_point [[buffer(3)]],
    constant uint& count [[buffer(4)]],
    uint gid [[thread_position_in_grid]]
) {
    if (gid >= count) return;

    float scaled = input[gid] / scale + zero_point;
    quantized[gid] = char(clamp(scaled, -128.0f, 127.0f));
}
