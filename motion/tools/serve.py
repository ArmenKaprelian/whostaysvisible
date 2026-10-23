#!/usr/bin/env python3
"""Static server for the motion pages (stdlib only). Serves the motion/ folder on 127.0.0.1.

Usage: python3 -I motion/tools/serve.py [--port 8765] [--dir motion]
Prints "serving http://127.0.0.1:PORT/" once the socket is bound. Used by the capture script and
by the desktop app's browser pane (see .claude/launch.json)."""
import argparse, functools, http.server, os, sys

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8765)
ap.add_argument("--dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
a = ap.parse_args()
root = os.path.abspath(a.dir)

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

handler = functools.partial(Handler, directory=root)
with http.server.ThreadingHTTPServer(("127.0.0.1", a.port), handler) as httpd:
    print("serving http://127.0.0.1:%d/ from %s" % (httpd.server_address[1], root), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
