#!/usr/bin/env tsx
/*
 * vfkit boot benchmark with Datadog dd-trace
 * - Creates a tiny Alpine VM (initramfs boot)
 * - Measures timings for: directories, kernel fetch, rootfs ensure, disk create, launch, boot wait
 * - Tears the VM down after
 */

import 'dd-trace/init'
import tracer from 'dd-trace'
import { VfkitProvider } from '../src/lib/vm/providers/vfkit'

async function main() {
  const name = `bench-${Date.now()}`
  const provider = new VfkitProvider()

  const span = tracer.startSpan('vfkit.benchmark', {
    tags: {
      'vm.name': name,
      'service': process.env.DD_SERVICE || 'vibecode-webgui',
    },
  })

  const startedAt = Date.now()
  try {
    const vm = await provider.create({
      name,
      cpus: 2,
      memory: '512MB',
      disk: '64MB',
      arch: 'arm64',
      ports: [],
    } as any)

    const launchedAt = Date.now()
    const createMs = launchedAt - startedAt
    span.setTag('vfkit.create.ms', createMs)

    // Minimal dwell so that logs flush
    await new Promise((r) => setTimeout(r, 1000))

    // Stop + destroy
    await provider.stop(vm.id)
    await provider.destroy(vm.id)

    const totalMs = Date.now() - startedAt
    span.setTag('vfkit.total.ms', totalMs)

    console.log(JSON.stringify({
      vm: vm.name,
      timings: {
        createMs,
        totalMs,
      },
      dd: {
        service: process.env.DD_SERVICE || 'vibecode-webgui',
        env: process.env.DD_ENV || 'development',
      },
    }, null, 2))

    span.finish()
    process.exit(0)
  } catch (err: any) {
    span.setTag('error', true)
    span.setTag('error.message', err?.message || String(err))
    span.finish()
    console.error('Benchmark failed:', err?.message || err)
    process.exit(1)
  }
}

main()
