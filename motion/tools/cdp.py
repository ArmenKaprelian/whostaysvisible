"""Minimal Chrome DevTools Protocol client over WebSocket, standard library only.

A page-level connection: connect(ws_url) to a target's webSocketDebuggerUrl, then call(method,
params). Events are buffered in .events and the ones that matter for a render (exceptions,
console messages, crashes) are kept in .problems. Frames use the RFC 6455 wire format: client
frames are masked; server frames may use 7-, 16- or 64-bit lengths and may be fragmented."""
import base64, hashlib, json, os, socket, struct, time
from urllib.parse import urlparse

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class WebSocket:
    def __init__(self, url, timeout=60.0):
        u = urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port or 80), timeout=timeout)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        path = u.path or "/"
        if u.query:
            path += "?" + u.query
        req = ("GET %s HTTP/1.1\r\nHost: %s:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (path, u.hostname, u.port or 80, key))
        self.sock.sendall(req.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket handshake closed early")
            head += chunk
        status, _, rest = head.partition(b"\r\n\r\n")
        lines = status.decode("latin-1").split("\r\n")
        if not lines[0].startswith("HTTP/1.1 101"):
            raise ConnectionError("WebSocket handshake failed: " + lines[0])
        accept = None
        for line in lines[1:]:
            k, _, v = line.partition(":")
            if k.strip().lower() == "sec-websocket-accept":
                accept = v.strip()
        expected = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        if accept != expected:
            raise ConnectionError("WebSocket accept key mismatch")
        self.buf = rest

    def _read_exact(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(max(65536, n - len(self.buf)))
            if not chunk:
                raise ConnectionError("WebSocket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send_text(self, text):
        payload = text.encode("utf-8")
        n = len(payload)
        header = bytearray([0x81])
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126); header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127); header += struct.pack(">Q", n)
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + mask + masked)

    def _send_control(self, opcode, payload=b""):
        mask = os.urandom(4)
        header = bytes([0x80 | opcode, 0x80 | len(payload)])
        self.sock.sendall(header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def recv_message(self):
        """Returns one complete text/binary message as bytes; answers pings; raises on close."""
        message = b""
        while True:
            b1, b2 = self._read_exact(2)
            fin, opcode = b1 & 0x80, b1 & 0x0F
            masked, n = b2 & 0x80, b2 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read_exact(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else None
            payload = self._read_exact(n)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 8:
                raise ConnectionError("WebSocket closed by peer")
            if opcode == 9:
                self._send_control(0xA, payload); continue
            if opcode == 0xA:
                continue
            message += payload
            if fin:
                return message

    def close(self):
        try:
            self._send_control(8, struct.pack(">H", 1000))
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


class CDP:
    def __init__(self, ws_url, timeout=60.0):
        self.ws = WebSocket(ws_url, timeout)
        self.next_id = 0
        self.events = []
        self.problems = []

    def _note(self, msg):
        m = msg.get("method")
        if m == "Runtime.exceptionThrown":
            d = msg["params"]["exceptionDetails"]
            self.problems.append({"kind": "exception", "text": d.get("text"), "description": (d.get("exception") or {}).get("description"), "line": d.get("lineNumber")})
        elif m == "Runtime.consoleAPICalled":
            p = msg["params"]
            if p.get("type") in ("error", "warning", "assert"):
                self.problems.append({"kind": "console." + p["type"], "args": [a.get("value", a.get("description")) for a in p.get("args", [])]})
        elif m in ("Inspector.targetCrashed", "Inspector.detached"):
            self.problems.append({"kind": m})
        self.events.append(msg)
        if len(self.events) > 2000:
            del self.events[:1000]

    def call(self, method, params=None, timeout=120.0):
        self.next_id += 1
        mid = self.next_id
        self.ws.send_text(json.dumps({"id": mid, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while True:
            if time.time() > deadline:
                raise TimeoutError("CDP %s timed out" % method)
            msg = json.loads(self.ws.recv_message().decode("utf-8"))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError("CDP %s: %s" % (method, msg["error"]))
                return msg.get("result", {})
            self._note(msg)

    def wait_event(self, method, timeout=60.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.ws.recv_message().decode("utf-8"))
            self._note(msg)
            if msg.get("method") == method:
                return msg.get("params", {})
        raise TimeoutError("event %s not received" % method)

    def evaluate(self, expression, await_promise=True, timeout=120.0):
        r = self.call("Runtime.evaluate", {"expression": expression, "awaitPromise": await_promise, "returnByValue": True}, timeout)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError("page exception: %s" % ((d.get("exception") or {}).get("description") or d.get("text")))
        return r.get("result", {}).get("value")

    def close(self):
        self.ws.close()
