import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { dirname, isAbsolute } from 'path'
import { StreamParser } from '../stream-parser'
import { log as _log } from '../logger'
import { getCliEnv } from '../cli-env'
import { providerRegistry } from '../providers/registry'
import type { NormalizedEvent, RunOptions, EnrichedError } from '../../shared/types'
import type { ProviderId } from '../../shared/provider-types'

const MAX_RING_LINES = 100
const DEBUG = process.env.CLUI_DEBUG === '1'

function log(msg: string): void {
  _log('RunManager', msg)
}

export interface RunHandle {
  runId: string
  providerId: ProviderId
  sessionId: string | null
  process: ChildProcess
  pid: number | null
  startedAt: number
  /** Ring buffer of last N stderr lines */
  stderrTail: string[]
  /** Ring buffer of last N stdout lines */
  stdoutTail: string[]
  /** Count of tool calls seen during this run */
  toolCallCount: number
  /** Whether any permission_request event was seen during this run */
  sawPermissionRequest: boolean
  /** Permission denials from result event */
  permissionDenials: Array<{ tool_name: string; tool_use_id: string }>
}

/**
 * RunManager: spawns one `claude -p` process per run, parses NDJSON,
 * emits normalized events, handles cancel, and keeps diagnostic ring buffers.
 *
 * Events emitted:
 *  - 'normalized' (runId, NormalizedEvent)
 *  - 'raw' (runId, ClaudeEvent)  — for logging/debugging
 *  - 'exit' (runId, code, signal, sessionId)
 *  - 'error' (runId, Error)
 */
export class RunManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  /** Holds recently-finished runs so diagnostics survive past process exit */
  private _finishedRuns = new Map<string, RunHandle>()

  constructor() {
    super()
    log(`Providers registered: ${providerRegistry.listAll().map((p) => p.id).join(', ')}`)
  }

  private _getEnv(binary: string, options: RunOptions): NodeJS.ProcessEnv {
    const provider = providerRegistry.resolve(options)
    const env = getCliEnv()
    if (isAbsolute(binary)) {
      const binDir = dirname(binary)
      if (env.PATH && !env.PATH.split(':').includes(binDir)) {
        env.PATH = `${binDir}:${env.PATH}`
      }
    }

    return provider.buildEnv ? provider.buildEnv(options, env) : env
  }

  startRun(requestId: string, options: RunOptions): RunHandle {
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath
    const provider = providerRegistry.resolve(options)
    const binary = provider.findBinary()

    if (!binary) {
      throw new Error(`${provider.displayName} binary not found`)
    }

    const args = provider.buildArgs(options)

    if (DEBUG) {
      log(`Starting run ${requestId}: ${binary} ${args.join(' ')}`)
      log(`Prompt: ${options.prompt.substring(0, 200)}`)
    } else {
      log(`Starting run ${requestId} via ${provider.id}`)
    }

    const child = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: this._getEnv(binary, options),
    })

    log(`Spawned PID: ${child.pid}`)

    const handle: RunHandle = {
      runId: requestId,
      providerId: provider.id,
      sessionId: options.sessionId || null,
      process: child,
      pid: child.pid || null,
      startedAt: Date.now(),
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
      permissionDenials: [],
    }

    // ─── stdout → NDJSON parser → normalizer → events ───
    const parser = StreamParser.fromStream(child.stdout!)

    parser.on('event', (raw: unknown) => {
      const event = raw && typeof raw === 'object' ? raw as Record<string, any> : null
      const eventType = typeof event?.type === 'string' ? event.type : null

      // Track session ID
      if (eventType === 'system' && event?.subtype === 'init') {
        handle.sessionId = event.session_id
      }

      // Track permission_request events
      if (eventType === 'permission_request' || (eventType === 'system' && event?.subtype === 'permission_request')) {
        handle.sawPermissionRequest = true
        log(`Permission request seen [${requestId}]`)
      }

      // Extract permission_denials from result event
      if (eventType === 'result') {
        const denials = event?.permission_denials
        if (Array.isArray(denials) && denials.length > 0) {
          handle.permissionDenials = denials.map((d: any) => ({
            tool_name: d.tool_name || '',
            tool_use_id: d.tool_use_id || '',
          }))
          log(`Permission denials [${requestId}]: ${JSON.stringify(handle.permissionDenials)}`)
        }
      }

      // Ring buffer stdout lines (raw JSON for diagnostics)
      const rawLine = JSON.stringify(raw) ?? String(raw)
      this._ringPush(handle.stdoutTail, rawLine.substring(0, 300))

      // Emit raw event for debugging
      this.emit('raw', requestId, raw)

      // Normalize and emit canonical events
      const normalized = provider.normalizeEvent(raw)
      if (normalized) {
        if (normalized.type === 'tool_call') handle.toolCallCount++
        this.emit('normalized', requestId, normalized)
      }

      // Close stdin after result event — with stream-json input the process
      // stays alive waiting for more input; closing stdin triggers clean exit.
      if (eventType === 'result') {
        log(`Run complete [${requestId}]: sawPermissionRequest=${handle.sawPermissionRequest}, denials=${handle.permissionDenials.length}`)
        try { child.stdin?.end() } catch {}
      }
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${requestId}]: ${line.substring(0, 200)}`)
      this._ringPush(handle.stderrTail, `[parse-error] ${line.substring(0, 200)}`)
    })

    // ─── stderr ring buffer ───
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      const lines = data.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        this._ringPush(handle.stderrTail, line)
      }
      log(`Stderr [${requestId}]: ${data.trim().substring(0, 500)}`)
    })

    // ─── Process lifecycle ───
    // Snapshot diagnostics BEFORE deleting the handle so callers can still read them.
    child.on('close', (code, signal) => {
      log(`Process closed [${requestId}]: code=${code} signal=${signal}`)
      // Move handle to finished map so getEnrichedError still works after exit
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, code, signal, handle.sessionId)
      // Clean up finished run after a short delay (gives callers time to read diagnostics)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    child.on('error', (err) => {
      log(`Process error [${requestId}]: ${err.message}`)
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('error', requestId, err)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    // Claude uses stream-json stdin. Other providers receive the prompt as CLI args.
    if (provider.id === 'claude') {
      const userMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'text', text: options.prompt }],
        },
      })
      child.stdin!.write(userMessage + '\n')
    } else {
      try { child.stdin?.end() } catch {}
    }

    this.activeRuns.set(requestId, handle)
    return handle
  }

  /**
   * Write a message to a running process's stdin (for follow-up prompts, etc.)
   */
  writeToStdin(requestId: string, message: object): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false
    if (!handle.process.stdin || handle.process.stdin.destroyed) return false

    const json = JSON.stringify(message)
    log(`Writing to stdin [${requestId}]: ${json.substring(0, 200)}`)
    handle.process.stdin.write(json + '\n')
    return true
  }

  /**
   * Cancel a running process: SIGINT, then SIGKILL after 5s.
   */
  cancel(requestId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Cancelling run ${requestId}`)
    handle.process.kill('SIGINT')

    // Fallback: SIGKILL if process hasn't exited after 5s.
    // Only check exitCode — process.killed is set true by the SIGINT call above,
    // so checking !killed would prevent the fallback from ever firing.
    setTimeout(() => {
      if (handle.process.exitCode === null) {
        log(`Force killing run ${requestId} (SIGINT did not terminate)`)
        handle.process.kill('SIGKILL')
      }
    }, 5000)

    return true
  }

  /**
   * Get an enriched error object for a failed run.
   */
  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const handle = this.activeRuns.get(requestId) || this._finishedRuns.get(requestId)
    return {
      message: `Run failed with exit code ${exitCode}`,
      stderrTail: handle?.stderrTail.slice(-20) || [],
      stdoutTail: handle?.stdoutTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.sawPermissionRequest || false,
      permissionDenials: handle?.permissionDenials || [],
    }
  }

  isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId)
  }

  getHandle(requestId: string): RunHandle | undefined {
    return this.activeRuns.get(requestId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }

  private _ringPush(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > MAX_RING_LINES) {
      buffer.shift()
    }
  }
}
