#!/usr/bin/env python3

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j import AsyncGraphDatabase, RoutingControl
from mcp_neo4j_cypher.server import create_mcp_server
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neo4j-mcp-http")

# Create FastAPI app
app = FastAPI(
    title="Neo4j MCP HTTP Server",
    description="HTTP REST wrapper for Neo4j MCP Server",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
neo4j_driver = None
mcp_server = None

# Request/Response models
class ToolRequest(BaseModel):
    arguments: Optional[Dict[str, Any]] = {}

class ToolResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

# Initialize Neo4j connection and MCP server
async def initialize():
    global neo4j_driver, mcp_server
    
    db_url = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    database = os.getenv("NEO4J_DATABASE", "neo4j")
    namespace = os.getenv("NEO4J_NAMESPACE", "")
    
    logger.info(f"Connecting to Neo4j at {db_url}")
    
    neo4j_driver = AsyncGraphDatabase.driver(
        db_url,
        auth=(username, password)
    )
    
    mcp_server = create_mcp_server(neo4j_driver, database, namespace)
    logger.info("Neo4j MCP HTTP Server initialized")

@app.on_event("startup")
async def startup_event():
    await initialize()

@app.on_event("shutdown")
async def shutdown_event():
    if neo4j_driver:
        await neo4j_driver.close()

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "neo4j-mcp-server",
        "version": "1.0.0",
        "timestamp": "2025-08-22T00:00:00.000Z"
    }

# Tools list endpoint
@app.get("/tools")
async def list_tools():
    return {
        "tools": [
            "get_neo4j_schema",
            "read_neo4j_cypher", 
            "write_neo4j_cypher"
        ]
    }

# Tool execution endpoints
@app.post("/tools/get_neo4j_schema")
async def get_neo4j_schema(request: ToolRequest):
    try:
        # Get the Neo4j schema using APOC
        get_schema_query = "CALL apoc.meta.schema();"
        
        result = await neo4j_driver.execute_query(
            get_schema_query,
            routing_control=RoutingControl.READ,
            database_=os.getenv("NEO4J_DATABASE", "neo4j"),
            result_transformer_=lambda r: r.data()
        )
        
        if result and len(result) > 0:
            schema_data = result[0].get('value', {})
            return ToolResponse(success=True, data=schema_data)
        else:
            return ToolResponse(success=True, data={})
            
    except Exception as e:
        logger.error(f"Error getting Neo4j schema: {e}")
        if "Neo.ClientError.Procedure.ProcedureNotFound" in str(e):
            error_msg = "Neo4j instance does not have the APOC plugin installed. Please install and enable the APOC plugin."
        else:
            error_msg = f"Neo4j Error: {str(e)}"
        return ToolResponse(success=False, error=error_msg)

@app.post("/tools/read_neo4j_cypher")
async def read_neo4j_cypher(request: ToolRequest):
    try:
        args = request.arguments
        query = args.get("query")
        params = args.get("params", {})
        database = args.get("database", os.getenv("NEO4J_DATABASE", "neo4j"))
        
        if not query:
            return ToolResponse(success=False, error="Query parameter is required")
        
        # Check if it's a write query (should be rejected for read endpoint)
        write_keywords = ["MERGE", "CREATE", "SET", "DELETE", "REMOVE", "ADD"]
        if any(keyword in query.upper() for keyword in write_keywords):
            return ToolResponse(success=False, error="Only MATCH queries are allowed for read-query")
        
        result = await neo4j_driver.execute_query(
            query,
            parameters_=params,
            routing_control=RoutingControl.READ,
            database_=database,
            result_transformer_=lambda r: r.data()
        )
        
        return ToolResponse(success=True, data=result)
        
    except Exception as e:
        logger.error(f"Error executing read query: {e}")
        return ToolResponse(success=False, error=f"Neo4j Error: {str(e)}")

@app.post("/tools/write_neo4j_cypher")
async def write_neo4j_cypher(request: ToolRequest):
    try:
        args = request.arguments
        query = args.get("query")
        params = args.get("params", {})
        database = args.get("database", os.getenv("NEO4J_DATABASE", "neo4j"))
        
        if not query:
            return ToolResponse(success=False, error="Query parameter is required")
        
        # Check if it's actually a write query
        write_keywords = ["MERGE", "CREATE", "SET", "DELETE", "REMOVE", "ADD"]
        if not any(keyword in query.upper() for keyword in write_keywords):
            return ToolResponse(success=False, error="Only write queries are allowed for write-query")
        
        _, summary, _ = await neo4j_driver.execute_query(
            query,
            parameters_=params,
            routing_control=RoutingControl.WRITE,
            database_=database
        )
        
        counters = {
            "nodesCreated": summary.counters.nodes_created,
            "nodesDeleted": summary.counters.nodes_deleted,
            "relationshipsCreated": summary.counters.relationships_created,
            "relationshipsDeleted": summary.counters.relationships_deleted,
            "propertiesSet": summary.counters.properties_set,
            "labelsAdded": summary.counters.labels_added,
            "labelsRemoved": summary.counters.labels_removed
        }
        
        return ToolResponse(success=True, data=counters)
        
    except Exception as e:
        logger.error(f"Error executing write query: {e}")
        return ToolResponse(success=False, error=f"Neo4j Error: {str(e)}")

# Root endpoint
@app.get("/")
async def root():
    return {
        "service": "neo4j-mcp-server",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "tools": "/tools",
            "toolsCount": 3
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NEO4J_MCP_SERVER_PORT", "8002"))
    host = os.getenv("NEO4J_MCP_SERVER_HOST", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)