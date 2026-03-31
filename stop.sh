#!/usr/bin/env bash
# 停止 City Runner 静态服务器

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.server.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "服务器未运行 (无 PID 文件)"
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "服务器已停止 (PID $PID)"
else
    echo "进程 $PID 已不存在"
fi

rm -f "$PID_FILE"
