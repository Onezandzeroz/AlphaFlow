#!/bin/bash
cd /home/z/my-project
# Kill any existing instances
pkill -f "next dev -p 3000" 2>/dev/null || true
sleep 2

# Start the server
exec bun x next dev -p 3000
