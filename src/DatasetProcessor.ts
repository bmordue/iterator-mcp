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
      
      this.resetState(filePath, newRecords);

      return this.records.length;
    } catch (error) {
      throw new Error(`Failed to load dataset from '${filePath}'`, { cause: error });
    }
  }

  async loadJsonDataset(filePath: string, jqExpression: string): Promise<number> {
    try {
      const result = await this.executeJsonQuery(filePath, jqExpression);

      if (!Array.isArray(result)) {
        throw new Error(`jq expression must return an array, got: ${typeof result}`);
      }

      this.resetState(filePath, result);
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

  private async executeJsonQuery(filePath: string, jqExpression: string): Promise<any> {
    try {
      // Attempt to use jq when available for full expression support.
      return await jq.run(jqExpression, filePath, { output: 'json' });
    } catch (error) {
      if (this.shouldFallbackToInternalParser(error)) {
        return this.evaluateExpressionWithFallback(filePath, jqExpression);
      }
      throw error;
    }
  }

  private shouldFallbackToInternalParser(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      const errno = (error as NodeJS.ErrnoException).code;
      return errno === 'ENOENT';
    }
    return false;
  }

  private async evaluateExpressionWithFallback(filePath: string, jqExpression: string): Promise<any> {
    const fileContents = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContents);

    return this.applySimpleExpression(jsonData, jqExpression);
  }

  private applySimpleExpression(jsonData: any, jqExpression: string): any {
    const stages = jqExpression.split('|').map(stage => stage.trim()).filter(Boolean);
    if (stages.length === 0) {
      throw new Error(`Unsupported jq expression: ${jqExpression}`);
    }

    const [pathExpression, ...pipeline] = stages;

    if (!pathExpression || !pathExpression.startsWith('.')) {
      throw new Error(`Unsupported jq expression: ${jqExpression}`);
    }

    let result = this.resolveJsonPath(jsonData, pathExpression);

    for (const stage of pipeline) {
      result = this.applyPipelineStage(result, stage);
    }

    return result;
  }

  private resolveJsonPath(jsonData: any, pathExpression: string): any {
    const trimmed = pathExpression.trim();
    if (trimmed === '.') {
      return jsonData;
    }

    const rawSegments = trimmed.slice(1).split('.').filter(segment => segment.length > 0);
    const segments = rawSegments.map(segment => {
      const segmentTrimmed = segment.trim();
      if (segmentTrimmed.startsWith('"') && segmentTrimmed.endsWith('"')) {
        return segmentTrimmed.slice(1, -1);
      }
      return segmentTrimmed;
    });

    let current: any = jsonData;
    for (const segment of segments) {
      if (current === null || current === undefined || !(segment in current)) {
        throw new Error(`Path segment '${segment}' not found in JSON data`);
      }
      current = current[segment];
    }

    return current;
  }

  private applyPipelineStage(currentValue: any, stage: string): any {
    if (stage.startsWith('map(') && stage.endsWith(')')) {
      if (!Array.isArray(currentValue)) {
        throw new Error(`map/select stage requires an array input`);
      }

      const inner = stage.slice(4, -1).trim();
      if (!(inner.startsWith('select(') && inner.endsWith(')'))) {
        throw new Error(`Unsupported jq stage: ${stage}`);
      }

      const condition = inner.slice(7, -1).trim();
      return currentValue.filter(item => this.evaluateSelectCondition(item, condition));
    }

    throw new Error(`Unsupported jq stage: ${stage}`);
  }

  private evaluateSelectCondition(item: any, condition: string): boolean {
    const equalityMatch = condition.match(/^\.([A-Za-z0-9_]+)\s*==\s*(.+)$/);
    if (!equalityMatch) {
      throw new Error(`Unsupported jq select condition: ${condition}`);
    }

    const field = equalityMatch[1];
    const expectedRaw = equalityMatch[2];

    if (!field || expectedRaw === undefined) {
      throw new Error(`Unsupported jq select condition: ${condition}`);
    }

    const expectedValue = this.parseLiteral(expectedRaw.trim());

    return item?.[field] === expectedValue;
  }

  private parseLiteral(rawValue: string): any {
    if (rawValue === 'true') {
      return true;
    }
    if (rawValue === 'false') {
      return false;
    }
    if (rawValue === 'null') {
      return null;
    }
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      return rawValue.slice(1, -1);
    }

    const maybeNumber = Number(rawValue);
    if (!Number.isNaN(maybeNumber)) {
      return maybeNumber;
    }

    throw new Error(`Unsupported literal value: ${rawValue}`);
  }
}
