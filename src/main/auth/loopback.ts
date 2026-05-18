import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'

interface PairingResult {
  token: string
  server: string
}

interface AwaitOptions {
  timeoutMs?: number
}

/**
 * Starts a loopback HTTP server that captures the SASO pairing callback.
 *
 * The SASO mobile-setup flow ends with a redirect to
 *   {redirect_uri}#token={raw}&state={state}&server={base}
 * The fragment never reaches the server, so /callback serves a tiny HTML
 * page that reads `location.hash` in JS and POSTs the values to
 * /submit-token. That handler resolves the returned promise.
 */
export async function awaitPairingCallback(
  expectedState: string,
  options: AwaitOptions = {}
): Promise<{ port: number; promise: Promise<PairingResult>; dispose: () => void }> {
  const timeoutMs = options.timeoutMs ?? 5 * 60_000

  let resolveOuter!: (value: PairingResult) => void
  let rejectOuter!: (err: Error) => void
  const promise = new Promise<PairingResult>((res, rej) => {
    resolveOuter = res
    rejectOuter = rej
  })

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || '/'
    if (req.method === 'GET' && url.startsWith('/callback')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(callbackHtml())
      return
    }
    if (req.method === 'POST' && url.startsWith('/submit-token')) {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 10_000) {
          req.destroy()
        }
      })
      req.on('end', () => {
        try {
          const params = new URLSearchParams(body)
          const token = params.get('token') || ''
          const state = params.get('state') || ''
          const server = params.get('server') || ''
          if (state !== expectedState) {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('state mismatch')
            rejectOuter(new Error('state mismatch — possible CSRF'))
            return
          }
          if (!token) {
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('missing token')
            rejectOuter(new Error('no pairing token in callback'))
            return
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(successHtml())
          resolveOuter({ token, server })
        } catch (err) {
          res.writeHead(500)
          res.end()
          rejectOuter(err as Error)
        }
      })
      return
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const port = (server.address() as AddressInfo).port

  const timer = setTimeout(() => {
    rejectOuter(new Error('pairing timed out'))
  }, timeoutMs)

  const dispose = (): void => {
    clearTimeout(timer)
    try {
      server.close()
    } catch {
      // ignore
    }
  }

  // Close the server shortly after the promise settles so the success page
  // has time to load.
  promise.finally(() => {
    setTimeout(dispose, 500)
  })

  return { port, promise, dispose }
}

function callbackHtml(): string {
  return `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<title>SASO ペアリング</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1f2937;background:#f8fafc}</style>
<body>
  <p id="msg">ペアリングを処理しています…</p>
<script>
  (function () {
    var params = new URLSearchParams(location.hash.slice(1));
    var token = params.get('token') || '';
    var state = params.get('state') || '';
    var server = params.get('server') || '';
    fetch('/submit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: token, state: state, server: server }).toString()
    }).then(function (r) {
      if (r.ok) {
        document.getElementById('msg').textContent = 'ペアリングに成功しました。このタブを閉じてください。';
      } else {
        document.getElementById('msg').textContent = 'ペアリングに失敗しました。アプリに戻って再試行してください。';
      }
    }).catch(function () {
      document.getElementById('msg').textContent = 'ネットワークエラー。アプリに戻って再試行してください。';
    });
  })();
</script>
</body>
</html>`
}

function successHtml(): string {
  return `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<title>SASO ペアリング完了</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1f2937;background:#f8fafc}</style>
<body>
  <p>ペアリングに成功しました。このタブを閉じてください。</p>
</body>
</html>`
}
