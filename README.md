# Quick start

1. **Install dependencies:**
```bash
npm install
```

2. **Build the TypeScript:**
```bash
npm run build
```

3. **Configure in your MCP client** (like Claude Desktop). Add to your config:
```json
{
  "mcpServers": {
    "dataset-processor": {
      "command": "node",
      "args": ["/path/to/your/dataset-processor-mcp/dist/index.js"]
    }
  }
}
```

## Usage Example

Once connected to an MCP-compatible chat interface, you can:

1. **Load a dataset:**
   - "Load my dataset from `/path/to/dataset.jsonl`"

2. **Process records iteratively:**
   - "Get the next record for processing"
   - *[AI processes the record and responds with analysis]*
   - "Save this result: [your analysis]"

3. **Track progress:**
   - "What's my processing status?"

4. **Export results:**
   - "Export all results to `/path/to/results.json`"

## Features

1. **No API Keys Required**: The MCP server acts as middleware, and you interact through your regular chat interface
2. **Stateful Processing**: The server maintains state between requests, tracking your progress
3. **Flexible Navigation**: You can jump to specific records, reset, or continue where you left off
4. **Error Recovery**: If something goes wrong, your progress is maintained
5. **Export Capabilities**: Save your processing results at any time
