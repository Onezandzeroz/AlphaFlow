#!/bin/bash
cd /home/z/my-project
while true; do
  if ! ss -tlnp | grep -q ':3000 '; then
    echo "[$(date)] Starting Next.js..." >> /home/z/my-project/dev.log
    bun x next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    NEXT_PID=$!
    disown $NEXT_PID 2>/dev/null
    sleep 10
  else
    echo "[$(date)] Next.js already running" >> /home/z/my-project/dev.log
  fi
  sleep 5
done
