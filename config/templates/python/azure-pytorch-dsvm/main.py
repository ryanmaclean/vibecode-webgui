import torch

def main():
    """Verifies the PyTorch installation and checks for GPU availability."""

    print(f"PyTorch Version: {torch.__version__}")
    print(f"TorchVision Version: N/A") # torchvision.__version__ is not always available

    # Check for CUDA (NVIDIA GPU)
    is_cuda_available = torch.cuda.is_available()
    print(f"CUDA (NVIDIA GPU) Available: {is_cuda_available}")

    if is_cuda_available:
        gpu_count = torch.cuda.device_count()
        print(f"Number of GPUs: {gpu_count}")
        for i in range(gpu_count):
            print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
    else:
        print("\nRunning on CPU. For accelerated training, consider using a workspace with a GPU.")

if __name__ == "__main__":
    main()
