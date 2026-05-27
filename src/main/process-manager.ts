import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { appendFileSync } from 'fs'
import { dirname, isAbsolute, join } from 'path'
import { StreamParser } from './stream-parser'
import { getCliEnv } from './cli-env'
import { providerRegistry } from './providers/registry'
import type { RunOptions } from '../shared/types'
import type { ProviderId } from '../shared/provider-types'

const LOG_FILE = join(homedir(), '.clui-debug.log')

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { appendFileSync(LOG_FILE, line) } catch {}
}

export interface RunHandle {
  runId: string
  providerId: ProviderId
  sessionId: string | null
  process: ChildProcess
  parser: StreamParser
}

/**
 * Manages provider subprocesses.
 */
export class ProcessManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()

  constructor() {
    super()
    log(`Providers registered: ${providerRegistry.listAll().map((p) => p.id).join(', ')}`)
  }

  private getEnv(binary: string): NodeJS.ProcessEnv {
    const env = getCliEnv()
    if (!isAbsolute(binary)) return env

    const binDir = dirname(binary)
    if (env.PATH && !env.PATH.split(':').includes(binDir)) {
      env.PATH = `${binDir}:${env.PATH}`
    }

    return env
  }

  startRun(options: RunOptions): RunHandle {
    const runId = crypto.randomUUID()
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath
    const provider = providerRegistry.resolve(options)
    const binary = provider.findBinary()

    if (!binary) {
      throw new Error(`${provider.displayName} binary not found`)
    }

    const args = provider.buildArgs(options)

    log(`Starting run ${runId}: ${binary} ${args.join(' ')}`)
    log(`Prompt: ${options.prompt.substring(0, 200)}`)

    const child = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: this.getEnv(binary),
    })

    log(`Spawned PID: ${child.pid}`)

    const parser = StreamParser.fromStream(child.stdout!)

    const handle: RunHandle = {
      runId,
      providerId: provider.id,
      sessionId: null,
      process: child,
      parser,
    }

    parser.on('event', (event: unknown) => {
      const raw = event && typeof event === 'object' ? event as Record<string, any> : null
      log(`Event [${runId}]: ${raw?.type || 'unknown'}`)
      if (raw?.type === 'system' && raw.subtype === 'init') {
        handle.sessionId = raw.session_id
      }
      this.emit('event', runId, event)
      const normalized = provider.normalizeEvent(event)
      if (normalized) this.emit('normalized-event', runId, normalized)
      if (raw?.type === 'result') {
        try { child.stdin?.end() } catch {}
      }
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${runId}]: ${line.substring(0, 200)}`)
      this.emit('parse-error', runId, line)
    })

    child.on('close', (code) => {
      log(`Process closed [${runId}]: code=${code}`)
      this.activeRuns.delete(runId)
      this.emit('exit', runId, code, handle.sessionId)
    })

    child.on('error', (err) => {
      log(`Process error [${runId}]: ${err.message}`)
      this.activeRuns.delete(runId)
      this.emit('error', runId, err)
    })

    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      log(`Stderr [${runId}]: ${data.trim().substring(0, 500)}`)
      this.emit('stderr', runId, data)
    })

    if (provider.id === 'claude') {
      child.stdin!.write(JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: options.prompt }],
        },
      }) + '\n')
    } else {
      child.stdin!.end()
    }

    this.activeRuns.set(runId, handle)
    return handle
  }

  cancelRun(runId: string): boolean {
    const handle = this.activeRuns.get(runId)
    if (!handle) return false

    log(`Cancelling run ${runId}`)
    handle.process.kill('SIGINT')

    setTimeout(() => {
      if (handle.process.exitCode === null) {
        handle.process.kill('SIGTERM')
      }
    }, 5000)

    return true
  }

  isRunning(runId: string): boolean {
    return this.activeRuns.has(runId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }
}
