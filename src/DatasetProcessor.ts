import { promises as fs, createReadStream } from "fs";
import { createInterface } from "readline";
import jq from "node-jq";

export interface ProcessingResult {
  record_index: number;
  result: string;
}

export interface RecordData {
  record_number: number;
  total_records: number;
  record: any;
  progress: string;
}

export class DatasetProcessor {
  private currentDataset: string | null = null;
  private currentIndex: number = 0;
  private records: any[] = [];
  private processingResults: ProcessingResult[] = [];

  private resetState(filePath: string, records: any[]) {
    this.records = records;
    this.currentIndex = 0;
    this.currentDataset = filePath;
    this.processingResults = [];
  }

  async loadDataset(filePath: string): Promise<number> {
    try {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      const newRecords = [];
      for await (const line of rl) {
        if (line.trim()) {
          try {
            newRecords.push(JSON.parse(line));
          } catch (parseError) {
            console.warn(`Skipping invalid JSON line: ${line}`);
          }
        }
      }
      
      this.resetState(filePath, records);

      return this.records.length;
    } catch (error) {
      throw new Error(`Failed to load dataset from '${filePath}'`, { cause: error });
    }
  }

  async loadJsonDataset(filePath: string, jqExpression: string): Promise<number> {
    try {
      // Pass the file path directly to jq to avoid reading the file into Node's memory.
      const result = await jq.run(jqExpression, filePath, { output: 'json' });

      if (!Array.isArray(result)) {
        throw new Error(`jq expression must return an array, got: ${typeof result}`);
      }
      
      this.resetState(filePath, parsed);
      return this.records.length;
    } catch (error) {
      throw new Error(`Failed to load JSON dataset`, { cause: error });
    }
  }

  getNextRecord(): RecordData | null {
    if (this.currentIndex >= this.records.length) {
      return null;
    }

    const record = this.records[this.currentIndex];
    this.currentIndex += 1;
    
    return {
      record_number: this.currentIndex,
      total_records: this.records.length,
      record: record,
      progress: `${this.currentIndex}/${this.records.length}`
    };
  }

  saveResult(result: string): void {
    this.processingResults.push({
      record_index: this.currentIndex - 1,
      result: result
    });
  }

  getProcessingStatus() {
    return {
      dataset: this.currentDataset,
      current_record: this.currentIndex,
      total_records: this.records.length,
      completed: this.processingResults.length,
      remaining: this.records.length - this.currentIndex
    };
  }

  async exportResults(outputPath: string): Promise<void> {
    try {
      await fs.writeFile(
        outputPath, 
        JSON.stringify(this.processingResults, null, 2)
      );
    } catch (error) {
      throw new Error(`Failed to export results: ${error}`);
    }
  }

  // Additional utility methods
  hasMoreRecords(): boolean {
    return this.currentIndex < this.records.length;
  }

  resetToStart(): void {
    this.currentIndex = 0;
  }

  jumpToRecord(index: number): boolean {
    if (index >= 0 && index < this.records.length) {
      this.currentIndex = index;
      return true;
    }
    return false;
  }
}
