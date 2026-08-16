#!/usr/bin/env bash
set -e

# Stop services started by docker-compose
docker-compose down
echo "Services stopped"
