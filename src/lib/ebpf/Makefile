# eBPF Build System
# Extracted from Codex Salvage Branch eBPF implementation

# Configuration
CLANG ?= clang
LLVM_STRIP ?= llvm-strip
BPFTOOL ?= bpftool
KERNEL_SRC ?= /lib/modules/$(shell uname -r)/build
ARCH ?= $(shell uname -m | sed 's/x86_64/x86/' | sed 's/aarch64/arm64/')

# Directories
SRC_DIR := programs
OBJ_DIR := objects
SCRIPTS_DIR := scripts

# Source files
BPF_SOURCES := $(wildcard $(SRC_DIR)/*.bpf.c)
BPF_OBJECTS := $(BPF_SOURCES:$(SRC_DIR)/%.bpf.c=$(OBJ_DIR)/%.o)

# Compilation flags
BPF_CFLAGS := -g -O2 -Wall -Wextra -Wno-unused-parameter -Wno-unused-variable
BPF_CFLAGS += -target bpf -mcpu=v3 -march=bpf
BPF_CFLAGS += -I$(KERNEL_SRC)/arch/$(ARCH)/include
BPF_CFLAGS += -I$(KERNEL_SRC)/arch/$(ARCH)/include/generated
BPF_CFLAGS += -I$(KERNEL_SRC)/include
BPF_CFLAGS += -I$(KERNEL_SRC)/include/generated
BPF_CFLAGS += -I$(KERNEL_SRC)/arch/$(ARCH)/include/uapi
BPF_CFLAGS += -I$(KERNEL_SRC)/arch/$(ARCH)/include/generated/uapi
BPF_CFLAGS += -I$(KERNEL_SRC)/include/uapi
BPF_CFLAGS += -I$(KERNEL_SRC)/include/generated/uapi
BPF_CFLAGS += -include $(KERNEL_SRC)/include/linux/kconfig.h
BPF_CFLAGS += -D__KERNEL__ -D__BPF_TRACING__
BPF_CFLAGS += -DKBUILD_MODNAME='"ebpf"'

# Default target
all: $(BPF_OBJECTS) validate-btf

# Build eBPF objects
$(OBJ_DIR)/%.o: $(SRC_DIR)/%.bpf.c | $(OBJ_DIR)
	@echo "Building eBPF program: $<"
	$(CLANG) $(BPF_CFLAGS) -c $< -o $@
	$(LLVM_STRIP) -g $@

# Create object directory
$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

# Validate BTF support
validate-btf:
	@echo "Validating BTF support..."
	@if ! $(BPFTOOL) btf list > /dev/null 2>&1; then \
		echo "ERROR: BTF support not available. Kernel may be too old."; \
		exit 1; \
	fi
	@echo "✅ BTF support validated"

# Load eBPF programs
load: $(BPF_OBJECTS)
	@echo "Loading eBPF programs..."
	@for obj in $(BPF_OBJECTS); do \
		echo "Loading $$obj..."; \
		$(BPFTOOL) prog load $$obj /sys/fs/bpf/$$(basename $$obj .o) || true; \
	done

# Unload eBPF programs
unload:
	@echo "Unloading eBPF programs..."
	@for obj in $(BPF_OBJECTS); do \
		prog_name=$$(basename $$obj .o); \
		if [ -f /sys/fs/bpf/$$prog_name ]; then \
			echo "Unloading $$prog_name..."; \
			rm -f /sys/fs/bpf/$$prog_name; \
		fi; \
	done

# List loaded programs
list:
	@echo "Loaded eBPF programs:"
	$(BPFTOOL) prog list

# Run bpftrace scripts
run-scripts: validate-btf
	@echo "Running bpftrace scripts..."
	@for script in $(SCRIPTS_DIR)/*.bt; do \
		if [ -f "$$script" ]; then \
			echo "Running $$script..."; \
			bpftrace $$script & \
		fi; \
	done

# Test eBPF programs
test: load
	@echo "Testing eBPF programs..."
	@echo "Running CPU profile test..."
	bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s %s\n", comm, str(args->filename)); }' &
	@echo "Running memory allocation test..."
	bpftrace -e 'kprobe:kmalloc { printf("kmalloc size=%d\n", arg1); }' &
	@echo "Running network latency test..."
	bpftrace -e 'tracepoint:net:net_dev_xmit { printf("net_dev_xmit: %s\n", str(args->name)); }' &

# Clean build artifacts
clean:
	rm -rf $(OBJ_DIR)
	rm -f /sys/fs/bpf/*

# Install dependencies (Alpine Linux)
install-deps:
	@echo "Installing eBPF dependencies on Alpine Linux..."
	apk add --no-cache \
		bpftool \
		bpftrace \
		bcc-tools \
		clang \
		llvm \
		linux-headers \
		build-base \
		git

# Check system requirements
check-requirements:
	@echo "Checking eBPF system requirements..."
	@echo "Kernel version: $$(uname -r)"
	@echo "Architecture: $$(uname -m)"
	@echo "BTF support: $$($(BPFTOOL) btf list | wc -l) BTF objects"
	@echo "BPF filesystem: $$(mount | grep bpf || echo 'Not mounted')"
	@echo "Unprivileged BPF: $$(cat /proc/sys/kernel/unprivileged_bpf_disabled)"

# Generate vmlinux.h (if needed)
vmlinux.h:
	@echo "Generating vmlinux.h from kernel BTF..."
	$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h

# Help
help:
	@echo "eBPF Build System - Available targets:"
	@echo "  all              - Build all eBPF programs"
	@echo "  load             - Load eBPF programs into kernel"
	@echo "  unload           - Unload eBPF programs from kernel"
	@echo "  list             - List loaded eBPF programs"
	@echo "  test             - Test eBPF programs with bpftrace"
	@echo "  run-scripts      - Run bpftrace scripts"
	@echo "  validate-btf     - Validate BTF support"
	@echo "  install-deps     - Install Alpine Linux dependencies"
	@echo "  check-requirements - Check system requirements"
	@echo "  clean            - Clean build artifacts"
	@echo "  help             - Show this help"

.PHONY: all load unload list test run-scripts validate-btf install-deps check-requirements clean help vmlinux.h
