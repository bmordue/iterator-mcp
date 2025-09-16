# Iterator MCP Server

A Model Context Protocol (MCP) server for processing large datasets record by record. This server provides tools for loading datasets in JSON format and iterating through them with stateful progress tracking.

## Features

- **Multiple Dataset Formats**: Support for JSON Lines and JSON with jq expressions
- **Stateful Processing**: Maintains progress across requests
- **Flexible Navigation**: Jump to specific records, reset, or continue processing
- **Result Tracking**: Save processing results for each record
- **Progress Monitoring**: Track processing status and completion
- **Export Capabilities**: Export all results to a file

## Installation

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
    "iterator-mcp": {
      "command": "node",
      "args": ["/path/to/iterator-mcp/build/index.js"]
    }
  }
}
```

## Available Tools

### Dataset Loading

#### `load_dataset`
Load a dataset in JSON Lines format (one JSON object per line).

**Parameters:**
- `file_path` (string): Path to the dataset file

**Example:**
```bash
# dataset.jsonl content:
{"id": 1, "name": "Alice", "email": "alice@example.com"}
{"id": 2, "name": "Bob", "email": "bob@example.com"}
```

#### `load_json_dataset`
Load a JSON dataset using a jq expression that returns an array of records.

**Parameters:**
- `file_path` (string): Path to the JSON file
- `jq_expression` (string): jq expression that returns an array

**Examples:**
```bash
# For a JSON file like:
{
  "users": [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
  ]
}

# Use jq expression: ".users"
# Or for nested data: ".data.users[]"
# Or with filtering: ".users | map(select(.active == true))"
```

### Record Processing

#### `get_next_record`
Get the next record from the currently loaded dataset.

**Returns:**
- Record number and progress information
- The actual record data
- Total dataset size

#### `save_result`
Save a processing result for the current record.

**Parameters:**
- `result` (string): The processing result to save

### Dataset Navigation

#### `reset_to_start`
Reset the iterator to the beginning of the dataset.

#### `jump_to_record`
Jump to a specific record number in the dataset.

**Parameters:**
- `record_number` (number): The record number to jump to (0-based index)

### Status and Export

#### `get_status`
Get current processing status and progress information.

**Returns:**
- Current dataset path
- Current record position
- Total records
- Completed processing count
- Remaining records

#### `export_results`
Export all processing results to a file.

**Parameters:**
- `output_path` (string): Path where to save the results

## Usage Examples

### Processing JSON Lines Dataset

1. **Load dataset:**
   ```
   Use load_dataset with file_path: "/path/to/data.jsonl"
   ```

2. **Process records:**
   ```
   Use get_next_record to get the next item
   [Process the record with AI]
   Use save_result with your analysis
   ```

3. **Check progress:**
   ```
   Use get_status to see current progress
   ```

### Processing JSON Dataset with jq

1. **Load JSON dataset:**
   ```
   Use load_json_dataset with:
   - file_path: "/path/to/data.json"
   - jq_expression: ".users"
   ```

2. **Process with filtering:**
   ```
   Use load_json_dataset with:
   - file_path: "/path/to/data.json" 
   - jq_expression: ".users | map(select(.active == true))"
   ```

### Advanced jq Examples

- Extract all items from an array: `".items"`
- Get nested arrays: `".data.records[]"`
- Filter by condition: `".users | map(select(.status == \"active\"))"`
- Transform data: `".items | map({id: .id, name: .properties.name})"`
- Multiple conditions: `".data[] | select(.type == \"user\" and .active == true)"`

## Dependencies

- `@modelcontextprotocol/sdk`: MCP server framework
- `node-jq`: JSON processing with jq expressions
- `typescript`: TypeScript compiler

## Key Advantages

1. **No API Keys Required**: Works through your MCP-compatible chat interface
2. **Stateful Processing**: Maintains progress between requests
3. **Flexible Data Access**: Support for complex JSON structures with jq
4. **Error Recovery**: Resume processing from where you left off
5. **Result Persistence**: Save and export processing results
6. **Progress Tracking**: Always know where you are in the dataset

This approach combines the power of programmatic dataset iteration with the convenience of a conversational interface.