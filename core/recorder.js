const { spawn } = require('child_process')
const path = require('path')
const EventEmitter = require('events')

const WORKER = path.join(__dirname, 'audio_worker.py')

class AudioWorker extends EventEmitter {
  constructor() {
    super()
    this.proc = null
    this.ready = false
    this.buffer = ''
  }

  // Start the persistent Python worker process
  start() {
    console.log('[worker] Starting audio worker...')

    this.proc = spawn('python', [WORKER], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Parse newline-delimited JSON from stdout
    this.proc.stdout.on('data', (data) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() // keep incomplete line
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          this._handleMessage(msg)
        } catch (e) {
          console.log('[worker] stdout:', line)
        }
      }
    })

    this.proc.stderr.on('data', (d) => {
      const msg = d.toString().trim()
      if (msg) console.log('[worker] stderr:', msg)
    })

    this.proc.on('close', (code) => {
      console.log('[worker] Process exited:', code)
      this.ready = false
      this.emit('exit', code)
    })

    this.proc.on('error', (e) => {
      console.error('[worker] Spawn error:', e.message)
      this.emit('error', e)
    })
  }

  _handleMessage(msg) {
    console.log('[worker]', JSON.stringify(msg))
    switch (msg.status) {
      case 'ready':
        this.ready = true
        this.emit('ready', msg.message)
        break
      case 'loading':
        this.emit('loading', msg.message)
        break
      case 'recording':
        this.emit('recording')
        break
      case 'transcribing':
        this.emit('transcribing')
        break
      case 'done':
        this.emit('transcript', msg.text)
        break
      case 'error':
        this.emit('workerError', msg.message)
        break
    }
  }

  send(cmd) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(JSON.stringify(cmd) + '\n')
    }
  }

  startRecording() {
    this.send({ cmd: 'start' })
  }

  stopRecording() {
    this.send({ cmd: 'stop' })
  }

  stop() {
    this.send({ cmd: 'quit' })
    if (this.proc) this.proc.kill()
  }
}

module.exports = new AudioWorker()