import http.server, socketserver, os, sys
os.chdir(sys.argv[1])
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        p=self.translate_path(self.path)
        if not os.path.exists(p) or os.path.isdir(p) and not os.path.exists(os.path.join(p,'index.html')):
            self.path='/index.html'
        return super().do_GET()
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
socketserver.TCPServer(('',8099),H).serve_forever()
