import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DatasetProcessor } from "./DatasetProcessor.js";

class DatasetMCPServer {
  private server: Server;
  private processor: DatasetProcessor;

  constructor() {
    this.processor = new DatasetProcessor();
    this.server = new Server(
      {
        name: "dataset-processor",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "dataset://current",
            name: "Current Dataset Status",
            description: "Information about the currently loaded dataset",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === "dataset://current") {
        const status = this.processor.getProcessingStatus();
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      } else {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "load_dataset",
            description: "Load a dataset file for processing (supports JSON Lines format)",
            inputSchema: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "Path to the dataset file (JSON lines format)"
                }
              },
              required: ["file_path"]
            }
          },
          {
            name: "load_json_dataset",
            description: "Load a JSON dataset using a jq expression that returns an array of records",
            inputSchema: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "Path to the JSON file"
                },
                jq_expression: {
                  type: "string",
                  description: "jq expression that returns an array (e.g., '.data[]', '.items', '.[].records')"
                }
              },
              required: ["file_path", "jq_expression"]
            }
          },
          {
            name: "get_next_record",
            description: "Get the next record from the dataset for processing",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: "save_result",
            description: "Save the processing result for the current record",
            inputSchema: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  description: "The processing result to save"
                }
              },
              required: ["result"]
            }
          },
          {
            name: "export_results",
            description: "Export all processing results to a file",
            inputSchema: {
              type: "object",
              properties: {
                output_path: {
                  type: "string",
                  description: "Path where to save the results"
                }
              },
              required: ["output_path"]
            }
          },
          {
            name: "get_status",
            description: "Get current processing status and progress",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: "reset_to_start",
            description: "Reset the iterator to the beginning of the dataset",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: "jump_to_record",
            description: "Jump to a specific record number in the dataset",
            inputSchema: {
              type: "object",
              properties: {
                record_number: {
                  type: "number",
                  description: "The record number to jump to (0-based index)"
                }
              },
              required: ["record_number"]
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "load_dataset": {
            const { file_path } = args as { file_path: string };
            const count = await this.processor.loadDataset(file_path);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully loaded dataset with ${count} records from ${file_path}`
                }
              ]
            };
          }

          case "load_json_dataset": {
            const { file_path, jq_expression } = args as { file_path: string, jq_expression: string };
            const count = await this.processor.loadJsonDataset(file_path, jq_expression);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully loaded JSON dataset with ${count} records from ${file_path} using jq expression: ${jq_expression}`
                }
              ]
            };
          }

          case "get_next_record": {
            const recordData = this.processor.getNextRecord();
            if (recordData === null) {
              return {
                content: [
                  {
                    type: "text",
                    text: "No more records to process. Dataset iteration complete!"
                  }
                ]
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: `Record ${recordData.progress}:\n\n${JSON.stringify(recordData.record, null, 2)}`
                  }
                ]
              };
            }
          }

          case "save_result": {
            const { result } = args as { result: string };
            this.processor.saveResult(result);
            const status = this.processor.getProcessingStatus();
            return {
              content: [
                {
                  type: "text",
                  text: `Result saved for record ${status.current_record}. Processing progress: ${status.completed}/${status.total_records}`
                }
              ]
            };
          }

          case "export_results": {
            const { output_path } = args as { output_path: string };
            await this.processor.exportResults(output_path);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully exported ${this.processor.getProcessingStatus().completed} results to ${output_path}`
                }
              ]
            };
          }

          case "get_status": {
            const status = this.processor.getProcessingStatus();
            return {
              content: [
                {
                  type: "text",
                  text: `Dataset Status:\n${JSON.stringify(status, null, 2)}`
                }
              ]
            };
          }

          case "reset_to_start": {
            this.processor.resetToStart();
            return {
              content: [
                {
                  type: "text",
                  text: "Dataset iterator reset to the beginning"
                }
              ]
            };
          }

          case "jump_to_record": {
            const { record_number } = args as { record_number: number };
            const success = this.processor.jumpToRecord(record_number);
            if (success) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully jumped to record ${record_number}`
                  }
                ]
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: `Invalid record number ${record_number}. Dataset has ${this.processor.getProcessingStatus().total_records} records.`
                  }
                ]
              };
            }
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Dataset Processor MCP server running on stdio");
  }
}

// Main execution
const server = new DatasetMCPServer();
server.run().catch(console.error);