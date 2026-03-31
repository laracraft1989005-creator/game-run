#!/usr/bin/env bash
# 启动 City Runner 静态服务器
# 端口 7080，绑定 0.0.0.0（局域网可访问）

PORT=7080
HOST=0.0.0.0
DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.server.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "服务器已在运行 (PID $(cat "$PID_FILE"))，端口 $PORT"
    exit 0
fi

cd "$DIR"
nohup python3 -m http.server "$PORT" --bind "$HOST" > /dev/null 2>&1 &
echo $! > "$PID_FILE"

echo "City Runner 已启动"
echo "  本机访问: http://localhost:$PORT"
echo "  局域网:   http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
echo "  PID: $(cat "$PID_FILE")"
