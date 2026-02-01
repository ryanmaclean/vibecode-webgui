#!/usr/bin/env python3



# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

"""Measure vi launch latency inside qemu-based guests (OpenWrt, Yocto, etc.)."""
from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import argparse
import json
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pexpect


@dataclass
class QemuTarget:
  name: str
  description: str
  command: list[str]
  shell_prompt: str  # regex consumed by pexpect
  runs: int = 1
  login_prompt: Optional[str] = None
  username: Optional[str] = None
  password: Optional[str] = None
  pre_login_prompt: Optional[str] = None
  pre_login_send: Optional[str] = None
  vi_command: str = 'vi -u NONE -U NONE -c q'
  shutdown_command: str = 'poweroff'
  timeout: int = 120
  shutdown_timeout: int = 60


@dataclass
class Measurement:
  total_seconds: float
  vi_seconds: float


def run_target(target: QemuTarget, runs: int) -> dict:
  totals: list[float] = []
  vis: list[float] = []
  for idx in range(runs):
    child = pexpect.spawn(target.command[0], target.command[1:], encoding='utf-8', timeout=target.timeout)
    child.delaybeforesend = 0.05
    start_total = time.perf_counter()
    try:
      if target.pre_login_prompt:
        child.expect(target.pre_login_prompt, timeout=target.timeout)
        if target.pre_login_send is not None:
          child.sendline(target.pre_login_send)
        else:
          child.sendline('')
        child.expect(target.shell_prompt, timeout=target.timeout)
      else:
        if target.login_prompt:
          child.expect(target.login_prompt, timeout=target.timeout)
        if target.username:
          child.sendline(target.username)
        if target.password:
          child.expect('Password:', timeout=target.timeout)
          child.sendline(target.password)
        child.expect(target.shell_prompt, timeout=target.timeout)
      start_vi = time.perf_counter()
      child.sendline(target.vi_command)
      child.expect(target.shell_prompt, timeout=target.timeout)
      vi_elapsed = time.perf_counter() - start_vi
      total_elapsed = time.perf_counter() - start_total
      vis.append(vi_elapsed)
      totals.append(total_elapsed)
      child.sendline(target.shutdown_command)
      try:
        child.expect(pexpect.EOF, timeout=target.shutdown_timeout)
      except pexpect.TIMEOUT:
        child.terminate(force=True)
    finally:
      if child.isalive():
        child.close(force=True)
  return {
      'name': target.name,
      'description': target.description,
      'runs': runs,
      'avg_total_seconds': statistics.mean(totals) if totals else None,
      'avg_vi_seconds': statistics.mean(vis) if vis else None,
      'min_total_seconds': min(totals) if totals else None,
      'max_total_seconds': max(totals) if totals else None,
      'min_vi_seconds': min(vis) if vis else None,
      'max_vi_seconds': max(vis) if vis else None,
      'totals': totals,
      'vi_samples': vis,
  }


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--runs', type=int, default=3, help='Runs per guest (default: 3)')
  parser.add_argument('--output', type=Path, help='Optional JSON output path')
  args = parser.parse_args()

  repo_root = Path(__file__).resolve().parents[2]
  targets = [
      QemuTarget(
          name='busybox_initramfs',
          description='Custom BusyBox initramfs (MiniVim x86_64 kernel)',
          command=[
              'qemu-system-x86_64',
              '-m', '256',
              '-kernel', str(repo_root / 'bench-images' / 'minivim' / 'bzImage-x86_64-6.12.10'),
              '-initrd', str(repo_root / 'bench-images' / 'busybox' / 'busybox-initramfs.cpio.gz'),
              '-append', 'console=ttyS0 loglevel=3',
              '-nographic',
          ],
          shell_prompt=r'/ # ',
          shutdown_command='poweroff -f',
      ),
      QemuTarget(
          name='openwrt_busybox',
          description='OpenWrt 23.05.4 x86_64 (BusyBox userland)',
          command=[
              'qemu-system-x86_64',
              '-m', '256',
              '-drive',
              f'file={repo_root / "bench-images" / "openwrt" / "openwrt-23.05.4-x86-64-generic-ext4-combined.img"},format=raw,if=virtio',
              '-nographic',
          ],
          pre_login_prompt='Please press Enter to activate this console.',
          pre_login_send='',
          shell_prompt=r'root@.*:/#',
      ),
      QemuTarget(
          name='tinycore',
          description='TinyCore Linux 16.2 (serial autologin)',
          command=[
              'qemu-system-x86_64',
              '-m', '256',
              '-kernel', str(repo_root / 'bench-images' / 'tinycore' / 'boot' / 'vmlinuz64'),
              '-initrd', str(repo_root / 'bench-images' / 'tinycore' / 'corepure64-with-serial.gz'),
              '-append', 'console=ttyS0 loglevel=3',
              '-nographic',
          ],
          shell_prompt=r'tc@box:~\$ ',
          shutdown_command='sudo poweroff',
      ),
      QemuTarget(
          name='yocto_core_image_minimal',
          description='Yocto 5.2.3 core-image-minimal (qemux86-64)',
          command=[
              'qemu-system-x86_64',
              '-m', '512',
              '-nographic',
              '-kernel', str(repo_root / 'bench-images' / 'yocto' / 'bzImage'),
              '-append', 'root=/dev/vda rw console=ttyS0',
              '-drive',
              f'file={repo_root / "bench-images" / "yocto" / "core-image-minimal.ext4"},format=raw,if=virtio',
          ],
          login_prompt='login:',
          username='root',
          shell_prompt=r'root@.*:~#',
      ),
  ]

  results = []
  for target in targets:
    print(f"\n=== {target.name} ({target.description}) ===")
    result = run_target(target, args.runs)
    if result['avg_total_seconds'] is not None:
      print(
          f"total_avg={result['avg_total_seconds']:.3f}s total_min={result['min_total_seconds']:.3f}s "
          f"total_max={result['max_total_seconds']:.3f}s vi_avg={result['avg_vi_seconds']:.3f}s"
      )
    results.append(result)

  if args.output:
    payload = {
        'timestamp': time.time(),
        'runs': args.runs,
        'results': results,
    }
    args.output.write_text(json.dumps(payload, indent=2))
    print(f"\nWrote benchmark JSON to {args.output}")

  return 0


if __name__ == '__main__':
  raise SystemExit(main())