export class NetworkClient extends EventTarget {
  constructor() {
    super();
    this.socket = null;
    this.id = null;
    this.room = null;
    this.ping = 0;
    this.pingTimer = null;
    this.connected = false;
  }

  async join(room, name, operator, mode = 'single') {
    this.close();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('连接战术网络超时，请确认服务器已启动。'));
      }, 8000);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', room, name, operator, mode })));
      socket.addEventListener('message', (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'welcome') {
          clearTimeout(timeout);
          this.id = data.id; this.room = data.room; this.connected = true;
          this.pingTimer = setInterval(() => this.send({ type: 'ping', time: performance.now() }), 2000);
          resolve(data);
        }
        if (data.type === 'error') {
          clearTimeout(timeout); reject(new Error(data.message));
        }
        if (data.type === 'pong') this.ping = Math.round(performance.now() - data.time);
        this.dispatchEvent(new CustomEvent(data.type, { detail: data }));
      });
      socket.addEventListener('close', () => {
        clearTimeout(timeout);
        const wasConnected = this.connected;
        this.connected = false;
        if (wasConnected) this.dispatchEvent(new Event('disconnect'));
      });
      socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('无法连接服务器。请通过 npm run dev 启动游戏。'));
      });
    });
  }

  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data));
  }

  close() {
    clearInterval(this.pingTimer);
    this.connected = false;
    if (this.socket) {
      this.socket.onclose = null;
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close();
    }
    this.socket = null;
    this.id = null;
  }
}
