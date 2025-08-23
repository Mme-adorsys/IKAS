#!/bin/bash

# Entrypoint script for Neo4j MCP server
# Supports both HTTP REST wrapper and native MCP server modes

set -e

# Default mode is http-wrapper if not specified
MODE=${NEO4J_MCP_MODE:-"http-wrapper"}

echo "Starting Neo4j MCP Server in mode: $MODE"

case $MODE in
  "http-wrapper")
    echo "Running HTTP REST wrapper..."
    exec python src/http_wrapper.py
    ;;
  "mcp-server")
    echo "Running native MCP server..."
    # Use the CLI tool with environment variables
    exec mcp-neo4j-cypher \
      --db-url "${NEO4J_URI}" \
      --username "${NEO4J_USERNAME}" \
      --password "${NEO4J_PASSWORD}" \
      --database "${NEO4J_DATABASE}" \
      --transport "${NEO4J_TRANSPORT:-http}" \
      --server-host "${NEO4J_MCP_SERVER_HOST:-0.0.0.0}" \
      --server-port "${NEO4J_MCP_SERVER_PORT:-8002}" \
      --server-path "${NEO4J_MCP_SERVER_PATH:-/mcp/}"
    ;;
  *)
    echo "Error: Invalid mode '$MODE'. Must be 'http-wrapper' or 'mcp-server'"
    exit 1
    ;;
esac