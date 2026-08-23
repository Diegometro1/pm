#!/usr/bin/env bash
set -e

# Build and start frontend and backend using docker-compose
docker-compose up -d --build frontend backend

echo "Frontend: http://localhost:3000"
echo "Backend ping: http://localhost:8000/api/ping"