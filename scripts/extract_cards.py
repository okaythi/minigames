import os
import sys
import json
import base64
import socket
import threading
import subprocess
import http.server
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, 'public')
ICONS_DIR = os.path.join(PUBLIC_DIR, 'games', 'card-jitsu', 'card', 'icons')
OUTPUT_DIR = os.path.join(PUBLIC_DIR, 'games', 'card-jitsu', 'card', 'icons_png')

os.makedirs(OUTPUT_DIR, exist_ok=True)

done_event = threading.Event()
saved_counter = [0]
total_files = [0]

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

PORT = get_free_port()

RUNNER_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Card Extraction Batch Runner</title>
  <script>
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, attribs) {
      if (type === 'webgl' || type === 'webgl2') {
        attribs = Object.assign({}, attribs, { preserveDrawingBuffer: true });
      }
      return origGetContext.call(this, type, attribs);
    };
  </script>
  <script src="/games/card-jitsu/ruffle/ruffle.js"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: monospace; background: #1a1a1a; color: #fff; }
    #player-box { width: 234px; height: 264px; background: #000; margin: 12px 0; border: 1px solid #444; }
    ruffle-player { width: 234px; height: 264px; display: block; }
    #status { font-size: 14px; color: #00ff88; }
  </style>
</head>
<body>
  <h3>Card Extraction Batch Runner</h3>
  <div id="status">Initializing Ruffle...</div>
  <div id="player-box"></div>
  <script>
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      letterbox: "off",
      scale: "exactFit",
      forceScale: true,
      quality: "high",
      unmuteOverlay: "hidden",
      autoplay: "on"
    };

    async function runBatch() {
      const statusEl = document.getElementById('status');
      const box = document.getElementById('player-box');
      
      const ruffle = window.RufflePlayer.newest();
      const player = ruffle.createPlayer();
      player.style.width = '234px';
      player.style.height = '264px';
      box.appendChild(player);

      statusEl.textContent = 'Fetching card list...';
      const res = await fetch('/list');
      const files = await res.json();
      statusEl.textContent = `Found ${files.length} cards to extract.`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        statusEl.textContent = `[${i + 1}/${files.length}] Extracting ${file}...`;
        const swfUrl = `/games/card-jitsu/card/icons/${file}`;
        try {
          await player.load(swfUrl);
          // Wait for frame paint
          await new Promise(resolve => setTimeout(resolve, 180));

          const canvas = player.shadowRoot 
            ? player.shadowRoot.querySelector('canvas') 
            : player.querySelector('canvas');

          if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            await fetch('/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: file.replace('.swf', '.png'),
                image: dataUrl
              })
            });
          } else {
            console.error('No canvas found for', file);
          }
        } catch (err) {
          console.error('Error on', file, err);
        }
      }

      statusEl.textContent = 'All cards extracted! Notifying server...';
      await fetch('/done');
      window.close();
    }

    window.addEventListener('load', () => {
      runBatch().catch(err => {
        document.getElementById('status').textContent = 'Error: ' + err.message;
      });
    });
  </script>
</body>
</html>
"""

class BatchHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/runner':
            data = RUNNER_HTML.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path == '/list':
            files = [f for f in os.listdir(ICONS_DIR) if f.endswith('.swf')]
            def sort_key(fn):
                num = fn.replace('.swf', '')
                return int(num) if num.isdigit() else 999999
            files.sort(key=sort_key)
            total_files[0] = len(files)
            data = json.dumps(files).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path == '/done':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print(f"\\nBatch extraction completed! Total extracted: {saved_counter[0]}/{total_files[0]}")
            done_event.set()
            return

        # Static file delivery
        local_subpath = path.lstrip('/')
        if local_subpath.startswith('games/'):
            local_file = os.path.join(PUBLIC_DIR, local_subpath)
        elif local_subpath.startswith('public/'):
            local_file = os.path.join(PROJECT_ROOT, local_subpath)
        else:
            local_file = os.path.join(PUBLIC_DIR, local_subpath)

        if os.path.isfile(local_file):
            content_type = 'application/octet-stream'
            if local_file.endswith('.js'):
                content_type = 'application/javascript'
            elif local_file.endswith('.wasm'):
                content_type = 'application/wasm'
            elif local_file.endswith('.swf'):
                content_type = 'application/x-shockwave-flash'
            elif local_file.endswith('.png'):
                content_type = 'image/png'
            elif local_file.endswith('.html'):
                content_type = 'text/html'

            try:
                with open(local_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                filename = payload.get('name')
                img_data = payload.get('image', '')
                if ',' in img_data:
                    img_data = img_data.split(',', 1)[1]
                decoded = base64.b64decode(img_data)
                out_path = os.path.join(OUTPUT_DIR, filename)
                with open(out_path, 'wb') as f:
                    f.write(decoded)
                saved_counter[0] += 1
                if saved_counter[0] % 25 == 0 or saved_counter[0] == total_files[0]:
                    print(f"Progress: [{saved_counter[0]}/{total_files[0]}] saved {filename}")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

def main():
    server = http.server.HTTPServer(('127.0.0.1', PORT), BatchHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    print(f"Batch extraction server started on http://127.0.0.1:{PORT}")

    chrome_paths = [
        r'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        r'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        r'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        r'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    browser_bin = None
    for p in chrome_paths:
        if os.path.exists(p):
            browser_bin = p
            break

    if not browser_bin:
        print("No suitable Chrome or Edge binary found!")
        sys.exit(1)

    url = f"http://127.0.0.1:{PORT}/runner"
    print(f"Launching browser: {browser_bin}")
    print(f"Target URL: {url}")

    chrome_cmd = [
        browser_bin,
        '--headless=new',
        '--use-gl=angle',
        '--window-size=800,600',
        url
    ]
    proc = subprocess.Popen(chrome_cmd)

    # Wait for the batch runner to finish (max 600 seconds)
    print("Waiting for batch extraction to complete (up to 10 minutes on HDD)...")
    completed = done_event.wait(timeout=600)

    if completed:
        print("Done event received successfully.")
    else:
        print("Timeout waiting for done event!")

    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

    server.shutdown()
    print(f"Finished. Total PNGs in output: {len(os.listdir(OUTPUT_DIR))}")

if __name__ == '__main__':
    main()
