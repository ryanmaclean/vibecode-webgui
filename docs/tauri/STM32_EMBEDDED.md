# Tauri on STM32 Microcontrollers

Running Tauri applications on ARM Cortex-M embedded systems.

## Background

Daniel Thompson-Yvetot (Tauri founder) confirmed **Tauri apps running on STM32**, opening possibilities for:
- Industrial HMI (Human-Machine Interface)
- Embedded dashboards and control panels
- IoT device configuration interfaces
- Test equipment with graphical displays
- Automotive infotainment systems

## STM32 Platform Overview

### Supported Families

| Family | Core | RAM | Flash | Use Case |
|--------|------|-----|-------|----------|
| **STM32H7** | Cortex-M7 | 1-2 MB | 2 MB | High-performance HMI |
| **STM32F7** | Cortex-M7 | 512 KB | 2 MB | Graphics-intensive apps |
| **STM32F4** | Cortex-M4 | 256 KB | 1 MB | Industrial control |
| **STM32L4** | Cortex-M4 | 128 KB | 512 KB | Low-power IoT |

**Recommended**: STM32H7 series for Tauri (2 MB RAM minimum)

## System Requirements

### Minimum Hardware
- **CPU**: ARM Cortex-M7 @ 400+ MHz
- **RAM**: 2 MB SRAM (for WebView stack)
- **Flash**: 4+ MB (Tauri binary + assets)
- **Display**: SPI/RGB TFT (LVGL backend)

### Optional Peripherals
- **Storage**: SD card or external QSPI flash
- **Network**: Ethernet, WiFi (ESP32 co-processor), or cellular
- **USB**: For debugging and firmware updates
- **Serial**: UART for external communication

## Architecture Options

### 1. Native Bare-Metal (Recommended)

```
┌──────────────────┐
│   Tauri App      │
├──────────────────┤
│   Rust Runtime   │
├──────────────────┤
│   LVGL Graphics  │  ← Instead of WebView
├──────────────────┤
│   STM32 HAL      │
├──────────────────┤
│   ARM Cortex-M7  │
└──────────────────┘
```

**Pros**:
- Minimal RAM usage (16-20 MB total)
- Fast boot time (<1 second)
- Predictable real-time performance

**Cons**:
- No HTML/CSS (use Tauri + LVGL bindings)
- Limited to LVGL widgets

### 2. Embedded Linux (Alternative)

```
┌──────────────────┐
│   Tauri App      │
├──────────────────┤
│   WebKitGTK      │  ← Full WebView
├──────────────────┤
│   Embedded Linux │  (Yocto, Buildroot)
├──────────────────┤
│   ARM Cortex-A   │  (MPU required)
└──────────────────┘
```

**Requires**: STM32MP1 series (Cortex-A7 MPU)
- **RAM**: 256+ MB DDR3
- **Storage**: eMMC or SD card
- **Boot time**: 5-10 seconds
- **Full WebView** support with HTML/CSS

## Implementation: Bare-Metal Tauri

### 1. Cargo Configuration

```toml
# .cargo/config.toml
[target.thumbv7em-none-eabihf]
runner = "probe-rs run --chip STM32H750VBTx"
rustflags = [
  "-C", "link-arg=-Tlink.x",
  "-C", "link-arg=--nmagic",
]

[build]
target = "thumbv7em-none-eabihf"  # Cortex-M7F

[profile.release]
opt-level = "z"      # Optimize for size
lto = true           # Link-time optimization
codegen-units = 1
strip = true
```

### 2. Memory Layout

```rust
// memory.x (linker script)
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 2M
  RAM (rwx)   : ORIGIN = 0x24000000, LENGTH = 1M
  DTCM (rwx)  : ORIGIN = 0x20000000, LENGTH = 128K
  ITCM (rx)   : ORIGIN = 0x00000000, LENGTH = 64K
}

SECTIONS
{
  .tauri_stack (NOLOAD) : {
    . = ALIGN(8);
    _stack_start = .;
    . = . + 512K;  /* 512KB stack for Tauri */
    _stack_end = .;
  } > RAM
}
```

### 3. Tauri Backend (No WebView)

```rust
// src-tauri/src/main.rs
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use stm32h7xx_hal as hal;
use embedded_graphics::prelude::*;
use lvgl::widgets::Label;

mod commands;
mod serial;

#[entry]
fn main() -> ! {
    // Initialize STM32 peripherals
    let dp = hal::pac::Peripherals::take().unwrap();
    let pwr = dp.PWR.constrain();
    let vos = pwr.freeze();

    // Setup 400 MHz CPU clock
    let rcc = dp.RCC.constrain();
    let ccdr = rcc
        .sys_ck(400.MHz())
        .freeze(vos, &dp.SYSCFG);

    // Initialize LVGL display
    let display = init_display(&ccdr);

    // Tauri-like command handler
    let app = TauriApp::new()
        .invoke_handler(|cmd, args| match cmd {
            "greet" => commands::greet(args),
            "read_sensor" => commands::read_sensor(args),
            "serial_write" => serial::write(args),
            _ => Err("Unknown command"),
        })
        .run(display);

    loop {
        app.update();
    }
}
```

### 4. Command Handlers

```rust
// src-tauri/src/commands.rs
use alloc::string::String;
use core::fmt::Write;

pub fn greet(name: &str) -> Result<String, &'static str> {
    let mut buf = String::new();
    write!(&mut buf, "Hello, {}!", name)
        .map_err(|_| "Format error")?;
    Ok(buf)
}

pub fn read_sensor(_args: &str) -> Result<f32, &'static str> {
    // Read ADC or I2C sensor
    let temp = read_temperature_sensor();
    Ok(temp)
}
```

### 5. LVGL Frontend (Replaces WebView)

```rust
// Frontend with LVGL (no HTML/CSS)
use lvgl::widgets::{Label, Button, Slider};

fn create_ui(screen: &mut lvgl::Screen) {
    // Create label
    let mut label = Label::new(screen);
    label.set_text("STM32 Tauri Demo");
    label.align(Align::Center, 0, -40);

    // Create button (calls Tauri command)
    let mut btn = Button::new(screen);
    btn.set_size(120, 50);
    btn.align(Align::Center, 0, 0);
    btn.on_event(|_| {
        // Call Tauri command
        app.invoke("greet", "STM32");
    });

    // Create slider
    let mut slider = Slider::new(screen);
    slider.set_range(0, 100);
    slider.align(Align::Center, 0, 60);
}
```

## Memory Budget (STM32H750)

| Component | RAM | Flash |
|-----------|-----|-------|
| Tauri Core | 8 MB | 1.5 MB |
| LVGL Graphics | 2 MB | 200 KB |
| Framebuffer (480x272x16) | 262 KB | - |
| Stack | 512 KB | - |
| Heap | 256 KB | - |
| **Total** | **~11 MB** | **~1.7 MB** |

**Fits in STM32H750** with external QSPI RAM.

## Display Options

### 1. SPI TFT (ST7789, ILI9341)
- **Resolution**: 240x320, 320x480
- **Interface**: SPI (4-wire)
- **Framerate**: 20-30 FPS
- **Use case**: Simple control panels

### 2. RGB Parallel TFT
- **Resolution**: 480x272, 800x480
- **Interface**: LTDC (RGB888)
- **Framerate**: 60 FPS
- **Use case**: High-quality HMI

### 3. HDMI Output (via ADV7513)
- **Resolution**: 1920x1080
- **Interface**: LTDC + I2C
- **Use case**: Industrial displays

## Serial Communication Integration

```rust
// Combine Tauri + Serial for STM32
use stm32h7xx_hal::serial;

#[tauri::command]
fn read_external_device() -> Result<Vec<u8>, String> {
    let mut uart = UART1.lock().unwrap();
    let mut buf = [0u8; 128];

    uart.write_all(b"READ\r\n")
        .map_err(|_| "UART write failed")?;

    let n = uart.read(&mut buf)
        .map_err(|_| "UART read failed")?;

    Ok(buf[..n].to_vec())
}
```

## Use Cases

### 1. Industrial HMI Panel
```
STM32H750 + 7" TFT + Modbus RTU
- Display production metrics
- Control PLC parameters
- Log events to SD card
```

### 2. IoT Gateway Configuration
```
STM32F7 + 4.3" TFT + WiFi (ESP32)
- Configure WiFi credentials
- Set MQTT broker settings
- View sensor data graphs
```

### 3. Test Equipment UI
```
STM32H7 + 5" RGB TFT + USB
- Oscilloscope-like waveform display
- Multi-channel data logging
- Export to CSV via USB mass storage
```

### 4. Automotive Dashboard
```
STM32MP1 (Cortex-A) + HDMI + CAN
- Speedometer, tachometer
- Navigation (if GPS module)
- OBD-II diagnostics via CAN bus
```

## Build Instructions

```bash
# Install Rust embedded toolchain
rustup target add thumbv7em-none-eabihf

# Install probe-rs for flashing
cargo install probe-rs-tools --features cli

# Build for STM32H7
cargo build --release --target thumbv7em-none-eabihf

# Flash to device
probe-rs run --chip STM32H750VBTx target/thumbv7em-none-eabihf/release/tauri-stm32
```

## Debugging

```bash
# GDB debugging via ST-Link
probe-rs debug --chip STM32H750VBTx

# RTT (Real-Time Transfer) logging
probe-rs attach --chip STM32H750VBTx --protocol swd --speed 4000 --rtt
```

## Performance

| Metric | STM32H750 (400 MHz) | STM32MP157 (800 MHz) |
|--------|---------------------|----------------------|
| Boot time | 0.8s | 6s (Linux) |
| UI framerate | 30 FPS | 60 FPS |
| RAM usage | 11 MB | 128 MB |
| Power draw | 250 mW | 1.5 W |

## Limitations

### Bare-Metal Approach
- ❌ No HTML/CSS (LVGL only)
- ❌ No JavaScript (Rust only)
- ❌ No web APIs (fetch, etc.)
- ✅ Ultra-low latency
- ✅ Deterministic real-time

### Embedded Linux Approach
- ✅ Full Tauri experience (HTML/CSS/JS)
- ✅ WebView with modern web stack
- ❌ Higher RAM/storage requirements
- ❌ Slower boot time

## References

- **STM32H7 Datasheet**: https://www.st.com/resource/en/datasheet/stm32h750vb.pdf
- **LVGL Documentation**: https://docs.lvgl.io/
- **Embedded Rust Book**: https://docs.rust-embedded.org/book/
- **probe-rs**: https://probe.rs/
- **Tauri on Embedded**: https://github.com/tauri-apps/tauri/discussions/3978

## Next Steps

1. **Prototype on STM32H750 Discovery Kit** ($60 USD)
2. **Use LVGL bindings for Rust**: `lvgl` crate
3. **Test serial communication** with `serialport` crate
4. **Profile memory usage** with `probe-rs` and `cargo-bloat`
5. **Optimize binary size** with LTO and `opt-level = "z"`
