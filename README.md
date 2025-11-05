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

**Example dataset (`customer_data.jsonl`):**
```jsonl
{"id": 1, "name": "Alice Johnson", "email": "alice@example.com", "purchases": 15}
{"id": 2, "name": "Bob Smith", "email": "bob@example.com", "purchases": 3}
{"id": 3, "name": "Carol Brown", "email": "carol@example.com", "purchases": 22}
```

**Example conversation:**

1. **Load the dataset:**
   ```
   👤 "Load my customer data from /home/user/customer_data.jsonl"
   🤖 [Uses load_dataset tool]
   "Successfully loaded dataset with 3 records from /home/user/customer_data.jsonl"
   ```

2. **Start processing records:**
   ```
   👤 "Get the next customer record for analysis"
   🤖 [Uses get_next_record tool]
   "Record 1/3: 
   {
     "id": 1,
     "name": "Alice Johnson", 
     "email": "alice@example.com",
     "purchases": 15
   }"
   
   👤 "Analyze this customer's purchase behavior and categorize them"
   🤖 "Based on Alice Johnson's 15 purchases, I would categorize her as a 'Regular Customer' 
   with moderate engagement. She shows consistent purchasing behavior that suggests 
   loyalty but isn't in the high-value segment yet."
   
   👤 "Save that analysis"
   🤖 [Uses save_result tool]
   "Result saved for record 1. Processing progress: 1/3"
   ```

3. **Continue with next records:**
   ```
   👤 "Get the next record"
   🤖 [Uses get_next_record tool and continues the process]
   ```

4. **Check progress anytime:**
   ```
   👤 "What's my current processing status?"
   🤖 [Uses get_status tool]
   "Currently processing customer_data.jsonl: record 2 of 3 total records. 
   Completed analysis for 1 record, 1 remaining."
   ```

### Processing JSON Dataset Format

**Example dataset (`company_data.json`):**
```json
{
  "employees": [
    {"id": 1, "name": "John Doe", "department": "Engineering", "active": true, "salary": 75000},
    {"id": 2, "name": "Jane Smith", "department": "Marketing", "active": false, "salary": 65000},
    {"id": 3, "name": "Mike Wilson", "department": "Engineering", "active": true, "salary": 80000}
  ],
  "projects": [
    {"id": "P001", "name": "Website Redesign", "status": "active", "budget": 50000},
    {"id": "P002", "name": "Mobile App", "status": "planning", "budget": 120000}
  ],
  "sales": {
    "2024": {
      "Q1": [
        {"month": "January", "amount": 15000, "client": "TechCorp"},
        {"month": "February", "amount": 22000, "client": "StartupInc"},
        {"month": "March", "amount": 18500, "client": "Enterprise Ltd"}
      ]
    }
  },
  "metadata": {
    "last_updated": "2024-09-16",
    "total_employees": 3
  }
}
```

**Basic JSON Processing Examples:**

1. **Load all employees:**
   ```
   👤 "Load the employee data from /home/user/company_data.json, I want to process all employees"
   🤖 [Uses load_json_dataset with jq_expression: ".employees"]
   "Successfully loaded JSON dataset with 3 records from /home/user/company_data.json 
   using jq expression: .employees"
   
   👤 "Get the first employee"
   🤖 [Uses get_next_record tool]
   "Record 1/3:
   {
     "id": 1,
     "name": "John Doe",
     "department": "Engineering", 
     "active": true,
     "salary": 75000
   }"
   ```

2. **Load and filter active employees only:**
   ```
   👤 "Actually, let me reload and only process active employees"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.active == true))"]
   "Successfully loaded JSON dataset with 2 records from /home/user/company_data.json 
   using jq expression: .employees | map(select(.active == true))"
   
   👤 "Perfect! Now I only have active employees to analyze."
   ```

3. **Load projects data:**
   ```
   👤 "Now load the projects from that same file"
   🤖 [Uses load_json_dataset with jq_expression: ".projects"]
   "Successfully loaded JSON dataset with 2 records using jq expression: .projects"
   
   👤 "Get the next project"
   🤖 [Uses get_next_record tool]
   "Record 1/2:
   {
     "id": "P001",
     "name": "Website Redesign",
     "status": "active",
     "budget": 50000
   }"
   ```

4. **Load nested sales data:**
   ```
   👤 "Load the Q1 sales data from the same JSON file"
   🤖 [Uses load_json_dataset with jq_expression: ".sales.\"2024\".Q1"]
   "Successfully loaded JSON dataset with 3 records using jq expression: .sales.\"2024\".Q1"
   
   👤 "Show me the first Q1 sale"
   🤖 [Uses get_next_record tool]
   "Record 1/3:
   {
     "month": "January",
     "amount": 15000,
     "client": "TechCorp"
   }"
   ```

**Advanced JSON Processing with Filtering:**

1. **Filter by salary range:**
   ```
   👤 "Load only employees with salary above 70000 from /home/user/company_data.json"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.salary > 70000))"]
   "Successfully loaded JSON dataset with 2 records using filter for high-salary employees"
   ```

2. **Filter by department:**
   ```
   👤 "Load only Engineering employees from that same file"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.department == \"Engineering\"))"]
   "Successfully loaded JSON dataset with 2 records using jq expression: 
   .employees | map(select(.department == \"Engineering\"))"
   ```

3. **Complex filtering with multiple conditions:**
   ```
   👤 "Load active Engineering employees with salary above 75000"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.department == \"Engineering\" and .active == true and .salary > 75000))"]
   "Successfully loaded JSON dataset with 1 record matching your criteria"
   ```

4. **Load and transform data structure:**
   ```
   👤 "Load employee names and departments only from the JSON file"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map({name: .name, dept: .department})"]
   "Successfully loaded JSON dataset with 3 transformed records"
   
   👤 "Show the first transformed record"
   🤖 [Uses get_next_record tool]
   "Record 1/3:
   {
     "name": "John Doe",
     "dept": "Engineering"
   }"
   ```

### Processing JSON Dataset with jq

**Example conversations:**

1. **Load all employees:**
   ```
   👤 "Load the employee data from /home/user/company_data.json, I want to process all employees"
   🤖 [Uses load_json_dataset with jq_expression: ".employees"]
   "Successfully loaded JSON dataset with 3 records from /home/user/company_data.json 
   using jq expression: .employees"
   ```

2. **Load only active employees:**
   ```
   👤 "Actually, let me reload and only process active employees"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.active == true))"]
   "Successfully loaded JSON dataset with 2 records from /home/user/company_data.json 
   using jq expression: .employees | map(select(.active == true))"
   
   👤 "Get the first active employee"
   🤖 [Uses get_next_record tool]
   "Record 1/2:
   {
     "id": 1,
     "name": "John Doe",
     "department": "Engineering", 
     "active": true,
     "salary": 75000
   }"
   ```

3. **Load and filter by department:**
   ```
   👤 "Load only Engineering employees from that same file"
   🤖 [Uses load_json_dataset with jq_expression: ".employees | map(select(.department == \"Engineering\"))"]
   "Successfully loaded JSON dataset with 2 records using jq expression: 
   .employees | map(select(.department == \"Engineering\"))"
   ```

### Advanced Processing Workflow

**Complex dataset processing example:**

```
👤 "Load sales data from /data/quarterly_sales.json, but only get Q3 sales where amount > 1000"

🤖 [Uses load_json_dataset with jq_expression: ".quarters.Q3.sales | map(select(.amount > 1000))"]

👤 "Perfect! Now analyze each high-value Q3 sale for trends"

🤖 [Uses get_next_record, provides analysis]

👤 "That's interesting. Save this analysis: 'High-value enterprise client, shows seasonal purchasing pattern, recommend Q4 follow-up'"

🤖 [Uses save_result tool]

👤 "Continue to the next record"

🤖 [Continues processing...]

👤 "Actually, let me jump back to record 1 to compare"

🤖 [Uses jump_to_record with record_number: 0]

👤 "When I'm done, export all my analysis to /results/q3_analysis.json"

🤖 [Uses export_results tool]
```

### Navigation and Control Examples

```
👤 "Reset back to the beginning of the dataset"
🤖 [Uses reset_to_start tool]

👤 "Jump to record number 5"  
🤖 [Uses jump_to_record tool]

👤 "How many records are left to process?"
🤖 [Uses get_status tool]

👤 "Export all my results so far to /backup/partial_results.json"
🤖 [Uses export_results tool]
```

### Real-World JSON Processing Scenarios

**Scenario 1: Employee Performance Review**
```json
// hr_data.json
{
  "employees": [...],
  "performance_reviews": [...],
  "departments": {...}
}
```
```
👤 "Load employees from hr_data.json for performance review analysis"
🤖 [Uses load_json_dataset with ".employees"]

👤 "Get the next employee for review"
🤖 [Shows employee record]

👤 "Analyze their performance metrics and provide recommendations"
🤖 [Analysis] "Save this review: 'Strong performer, recommend for senior role'"
🤖 [Uses save_result]
```

**Scenario 2: Sales Data Analysis**
```json
// quarterly_sales.json
{
  "2024": {
    "Q1": [...],
    "Q2": [...],
    "Q3": [...]
  }
}
```
```
👤 "Load high-value Q3 sales over $5000 from quarterly_sales.json"
🤖 [Uses load_json_dataset with ".\"2024\".Q3 | map(select(.amount > 5000))"]

👤 "Analyze each sale for client retention patterns"
🤖 [Processes each high-value sale individually]
```

**Scenario 3: Product Inventory Management**
```json
// inventory.json
{
  "products": [...],
  "categories": [...],
  "suppliers": [...]
}
```
```
👤 "Load low-stock products (quantity < 50) from inventory.json"
🤖 [Uses load_json_dataset with ".products | map(select(.quantity < 50))"]

👤 "For each product, determine reorder priority and supplier contact"
🤖 [Processes each low-stock item with business logic]
```

### Format Comparison: JSON vs JSONL

**JSON Format Advantages:**
- Single file with multiple related datasets
- Supports complex nested structures
- Rich metadata and context in same file
- Flexible data organization (arrays, objects, nested data)

**JSONL Format Advantages:**
- Simpler, one record per line
- Easy to append new records
- Streaming-friendly for large datasets
- Direct processing without jq expressions

**Choosing the Right Format:**
- Use **JSON** when you have structured data with multiple related arrays or need to filter/transform data
- Use **JSONL** when you have simple records and want straightforward line-by-line processing

### Advanced jq Examples for JSON Processing

**Basic Array Extraction:**
- Extract all items from an array: `".items"`
- Extract users: `".users"`  
- Extract projects: `".projects"`

**Nested Data Access:**
- Get nested arrays: `".sales.\"2024\".Q1"`
- Multiple levels: `".departments.engineering.employees"`

**Filtering Examples:**
- Filter by condition: `".users | map(select(.status == \"active\"))"`
- Salary range: `".employees | map(select(.salary > 70000))"`
- Department filter: `".employees | map(select(.department == \"Engineering\"))"`
- Multiple conditions: `".employees | map(select(.active == true and .salary > 75000))"`
- Date filtering: `".sales.\"2024\".Q1 | map(select(.amount > 20000))"`

**Data Transformation:**
- Transform structure: `".items | map({id: .id, name: .properties.name})"`
- Rename fields: `".employees | map({emp_id: .id, full_name: .name, dept: .department})"`
- Calculate values: `".sales.\"2024\".Q1 | map({client: .client, amount: .amount, tax: (.amount * 0.1)})"`

**Complex jq Expressions:**
- Sort by field: `".employees | sort_by(.salary) | reverse"`
- Group by department: `".employees | group_by(.department)"`
- Count active users: `".users | map(select(.active == true)) | length"`
- Sum values: `".sales.\"2024\".Q1 | map(.amount) | add"`

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

## Features

1. **No API Keys Required**: The MCP server acts as middleware, and you interact through your regular chat interface
2. **Stateful Processing**: The server maintains state between requests, tracking your progress
3. **Flexible Navigation**: You can jump to specific records, reset, or continue where you left off
4. **Error Recovery**: If something goes wrong, your progress is maintained
5. **Export Capabilities**: Save your processing results at any time
