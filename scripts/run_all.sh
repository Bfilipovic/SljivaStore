#!/usr/bin/env bash
# Start Hardhat node, then backend and frontend servers.

# 🔹 Start Hardhat local chain
echo "⛓️  Starting Hardhat node..."
(cd eth && npx hardhat node) &
HARDHAT_PID=$!

# Wait for chain to start
sleep 5

# 🔹 Start backend
echo "🔨 Launching backend..."
(cd backend && node server.js) &
BACKEND_PID=$!

# 🔹 Start frontend
echo "🌐 Launching frontend..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "🚀 All services are running!"
echo "Hardhat PID: $HARDHAT_PID"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

echo "Press [CTRL+C] to shut down all."
wait
