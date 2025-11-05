import { promises as fs } from "fs";
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

  async loadDataset(filePath: string): Promise<number> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter((line: string) => line.trim());
      
      this.records = [];
      for (const line of lines) {
        try {
          this.records.push(JSON.parse(line));
        } catch (parseError) {
          console.warn(`Skipping invalid JSON line: ${line}`);
        }
      }
      
      this.currentIndex = 0;
      this.currentDataset = filePath;
      this.processingResults = []; // Clear previous results
      
      return this.records.length;
    } catch (error) {
      throw new Error(`Failed to load dataset from '${filePath}'`, { cause: error });
    }
  }

  async loadJsonDataset(filePath: string, jqExpression: string): Promise<number> {
    try {
      // Use jq to extract the array of records from the file
      const result = await jq.run(jqExpression, filePath);
      
      // Validate that jq.run returned a string before parsing
      if (typeof result !== 'string') {
        throw new Error(`Unexpected result type from jq: ${typeof result}`);
      }
      
      const parsed = JSON.parse(result);
      
      if (!Array.isArray(parsed)) {
        throw new Error(`jq expression must return an array, got: ${typeof parsed}`);
      }
      
      this.records = parsed;
      this.currentIndex = 0;
      this.currentDataset = filePath;
      this.processingResults = []; // Clear previous results
      
      return this.records.length;
    } catch (error) {
      throw new Error(`Failed to load JSON dataset: ${error}`);
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
