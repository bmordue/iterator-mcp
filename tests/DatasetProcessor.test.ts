import { DatasetProcessor } from '../src/DatasetProcessor.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock jq module to avoid dependency issues in tests
jest.mock('node-jq', () => ({
  run: jest.fn()
}));

import jq from 'node-jq';
const mockJq = jq as jest.Mocked<typeof jq>;

describe('DatasetProcessor', () => {
  let processor: DatasetProcessor;
  const testDataDir = path.join(__dirname, 'data');

  beforeEach(() => {
    processor = new DatasetProcessor();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test files created during testing
    const tempFiles = [
      path.join(testDataDir, 'temp_export.json'),
      path.join(testDataDir, 'test_results.json')
    ];
    
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
  });

  describe('JSONL Format Processing', () => {
    const testJsonlPath = path.join(testDataDir, 'test_data.jsonl');
    const productsJsonlPath = path.join(testDataDir, 'products.jsonl');

    test('should load JSONL dataset successfully', async () => {
      const count = await processor.loadDataset(testJsonlPath);
      expect(count).toBe(5);
      
      const status = processor.getProcessingStatus();
      expect(status.total_records).toBe(5);
      expect(status.current_record).toBe(0);
      expect(status.dataset).toBe(testJsonlPath);
    });

    test('should iterate through JSONL records correctly', async () => {
      await processor.loadDataset(productsJsonlPath);
      
      // Test first record
      const firstRecord = processor.getNextRecord();
      expect(firstRecord).not.toBeNull();
      expect(firstRecord!.record_number).toBe(1);
      expect(firstRecord!.total_records).toBe(4);
      expect(firstRecord!.record.name).toBe('Product A');
      expect(firstRecord!.progress).toBe('1/4');
      
      // Test second record
      const secondRecord = processor.getNextRecord();
      expect(secondRecord!.record_number).toBe(2);
      expect(secondRecord!.record.name).toBe('Product B');
      expect(secondRecord!.record.in_stock).toBe(false);
      
      // Test progress tracking
      const status = processor.getProcessingStatus();
      expect(status.current_record).toBe(2);
      expect(status.remaining).toBe(2);
    });

    test('should handle end of JSONL dataset', async () => {
      await processor.loadDataset(productsJsonlPath);
      
      // Consume all records
      for (let i = 0; i < 4; i++) {
        processor.getNextRecord();
      }
      
      // Should return null when no more records
      const nextRecord = processor.getNextRecord();
      expect(nextRecord).toBeNull();
      expect(processor.hasMoreRecords()).toBe(false);
    });

    test('should skip invalid JSON lines in JSONL', async () => {
      // Create a test file with some invalid JSON lines
      const testFile = path.join(testDataDir, 'mixed_valid_invalid.jsonl');
      const content = `{"id": 1, "valid": true}
invalid json line
{"id": 2, "valid": true}
{broken: json}
{"id": 3, "valid": true}`;
      
      await fs.writeFile(testFile, content);
      
      try {
        const count = await processor.loadDataset(testFile);
        expect(count).toBe(3); // Should only load valid JSON lines
        
        const firstRecord = processor.getNextRecord();
        expect(firstRecord!.record.id).toBe(1);
        
        const secondRecord = processor.getNextRecord();
        expect(secondRecord!.record.id).toBe(2);
        
        const thirdRecord = processor.getNextRecord();
        expect(thirdRecord!.record.id).toBe(3);
      } finally {
        await fs.unlink(testFile);
      }
    });

    test('should handle file not found error for JSONL', async () => {
      await expect(processor.loadDataset('nonexistent.jsonl'))
        .rejects.toThrow('Failed to load dataset');
    });
  });

  describe('JSON Format Processing', () => {
    const testJsonPath = path.join(testDataDir, 'test_data.json');
    const productsJsonPath = path.join(testDataDir, 'products.json');

    beforeEach(() => {
      // Reset mock before each test
      mockJq.run.mockReset();
    });

    test('should load JSON dataset with simple array extraction', async () => {
      const mockResult = [
        {"id": 1, "name": "Alice Johnson", "department": "Engineering"},
        {"id": 2, "name": "Bob Smith", "department": "Marketing"}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);

      const count = await processor.loadJsonDataset(testJsonPath, '.users');
      
      expect(count).toBe(2);
      expect(mockJq.run).toHaveBeenCalledWith('.users', expect.any(Object));
      
      const status = processor.getProcessingStatus();
      expect(status.total_records).toBe(2);
      expect(status.dataset).toBe(testJsonPath);
    });

    test('should handle filtered JSON dataset loading', async () => {
      const mockResult = [
        {"id": 1, "name": "Alice", "active": true},
        {"id": 3, "name": "Charlie", "active": true}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);

      const count = await processor.loadJsonDataset(
        testJsonPath, 
        '.users | map(select(.active == true))'
      );
      
      expect(count).toBe(2);
      expect(mockJq.run).toHaveBeenCalledWith(
        '.users | map(select(.active == true))',
        expect.any(Object)
      );
    });

    test('should handle nested JSON data extraction', async () => {
      const mockResult = [
        {"id": "O001", "product_id": 1, "quantity": 2},
        {"id": "O002", "product_id": 3, "quantity": 1}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);

      const count = await processor.loadJsonDataset(
        productsJsonPath,
        '.orders."2024".Q1'
      );
      
      expect(count).toBe(2);
      expect(mockJq.run).toHaveBeenCalledWith('.orders."2024".Q1', expect.any(Object));
    });

    test('should iterate through JSON records correctly', async () => {
      const mockResult = [
        {"id": 1, "name": "Laptop", "price": 999.99},
        {"id": 2, "name": "Book", "price": 24.99},
        {"id": 3, "name": "Headphones", "price": 199.99}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);

      await processor.loadJsonDataset(productsJsonPath, '.products');
      
      const firstRecord = processor.getNextRecord();
      expect(firstRecord!.record_number).toBe(1);
      expect(firstRecord!.record.name).toBe('Laptop');
      expect(firstRecord!.record.price).toBe(999.99);
      
      const secondRecord = processor.getNextRecord();
      expect(secondRecord!.record_number).toBe(2);
      expect(secondRecord!.record.name).toBe('Book');
      
      const status = processor.getProcessingStatus();
      expect(status.current_record).toBe(2);
      expect(status.completed).toBe(0); // No results saved yet
    });

    test('should handle jq expression returning non-array', async () => {
      mockJq.run.mockResolvedValueOnce({"not": "an array"});

      await expect(processor.loadJsonDataset(testJsonPath, '.metadata'))
        .rejects.toThrow('jq expression must return an array');
    });

    test('should handle JSON parsing errors', async () => {
      const invalidJsonPath = path.join(testDataDir, 'invalid.json');
      
      await expect(processor.loadJsonDataset(invalidJsonPath, '.data'))
        .rejects.toThrow('Failed to load JSON dataset');
    });

    test('should handle jq execution errors', async () => {
      mockJq.run.mockRejectedValueOnce(new Error('Invalid jq expression'));

      await expect(processor.loadJsonDataset(testJsonPath, 'invalid_jq'))
        .rejects.toThrow('Failed to load JSON dataset');
    });
  });

  describe('Dataset Navigation and Control', () => {
    beforeEach(async () => {
      const mockResult = [
        {"id": 1, "name": "Item 1"},
        {"id": 2, "name": "Item 2"},
        {"id": 3, "name": "Item 3"},
        {"id": 4, "name": "Item 4"},
        {"id": 5, "name": "Item 5"}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);
      await processor.loadJsonDataset('test.json', '.items');
    });

    test('should reset to start correctly', async () => {
      // Advance to middle of dataset
      processor.getNextRecord(); // Record 1
      processor.getNextRecord(); // Record 2
      processor.getNextRecord(); // Record 3
      
      expect(processor.getProcessingStatus().current_record).toBe(3);
      
      // Reset to start
      processor.resetToStart();
      
      expect(processor.getProcessingStatus().current_record).toBe(0);
      expect(processor.hasMoreRecords()).toBe(true);
      
      // Should get first record again
      const record = processor.getNextRecord();
      expect(record!.record_number).toBe(1);
      expect(record!.record.name).toBe('Item 1');
    });

    test('should jump to specific record correctly', async () => {
      // Jump to record at index 2 (3rd record)
      const success = processor.jumpToRecord(2);
      expect(success).toBe(true);
      
      const record = processor.getNextRecord();
      expect(record!.record_number).toBe(3);
      expect(record!.record.name).toBe('Item 3');
    });

    test('should handle invalid jump indices', async () => {
      expect(processor.jumpToRecord(-1)).toBe(false);
      expect(processor.jumpToRecord(5)).toBe(false);
      expect(processor.jumpToRecord(100)).toBe(false);
      
      // Current position should remain unchanged
      const record = processor.getNextRecord();
      expect(record!.record_number).toBe(1);
    });

    test('should track hasMoreRecords correctly', async () => {
      expect(processor.hasMoreRecords()).toBe(true);
      
      // Consume all records
      for (let i = 0; i < 5; i++) {
        expect(processor.hasMoreRecords()).toBe(true);
        processor.getNextRecord();
      }
      
      expect(processor.hasMoreRecords()).toBe(false);
    });
  });

  describe('Result Processing and Export', () => {
    beforeEach(async () => {
      const mockResult = [
        {"id": 1, "name": "Task 1"},
        {"id": 2, "name": "Task 2"},
        {"id": 3, "name": "Task 3"}
      ];
      mockJq.run.mockResolvedValueOnce(mockResult);
      await processor.loadJsonDataset('test.json', '.tasks');
    });

    test('should save processing results correctly', async () => {
      // Process first record and save result
      const record1 = processor.getNextRecord();
      processor.saveResult('Processed Task 1 - High Priority');
      
      // Process second record and save result
      const record2 = processor.getNextRecord();
      processor.saveResult('Processed Task 2 - Medium Priority');
      
      const status = processor.getProcessingStatus();
      expect(status.completed).toBe(2);
      expect(status.current_record).toBe(2);
      expect(status.remaining).toBe(1);
    });

    test('should export results to file correctly', async () => {
      // Process some records with results
      processor.getNextRecord();
      processor.saveResult('Result for record 1');
      
      processor.getNextRecord();
      processor.saveResult('Result for record 2');
      
      processor.getNextRecord();
      processor.saveResult('Result for record 3');
      
      // Export results
      const exportPath = path.join(testDataDir, 'test_results.json');
      await processor.exportResults(exportPath);
      
      // Verify exported file
      const exportedContent = await fs.readFile(exportPath, 'utf-8');
      const results = JSON.parse(exportedContent);
      
      expect(results).toHaveLength(3);
      expect(results[0].record_index).toBe(0);
      expect(results[0].result).toBe('Result for record 1');
      expect(results[1].record_index).toBe(1);
      expect(results[1].result).toBe('Result for record 2');
      expect(results[2].record_index).toBe(2);
      expect(results[2].result).toBe('Result for record 3');
    });

    test('should handle export errors gracefully', async () => {
      const invalidPath = '/invalid/path/results.json';
      
      await expect(processor.exportResults(invalidPath))
        .rejects.toThrow('Failed to export results');
    });

    test('should clear results when loading new JSON dataset', async () => {
      // Save some results
      processor.getNextRecord();
      processor.saveResult('First result');
      
      expect(processor.getProcessingStatus().completed).toBe(1);
      
      // Load new dataset
      const newMockResult = [{"id": 1, "data": "new"}];
      mockJq.run.mockResolvedValueOnce(newMockResult);
      await processor.loadJsonDataset('new.json', '.data');
      
      // Results should be cleared
      expect(processor.getProcessingStatus().completed).toBe(0);
    });
  });

  describe('Status and Progress Tracking', () => {
    test('should provide accurate status for empty dataset', () => {
      const status = processor.getProcessingStatus();
      
      expect(status.dataset).toBeNull();
      expect(status.current_record).toBe(0);
      expect(status.total_records).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.remaining).toBe(0);
    });

    test('should track progress accurately during processing', async () => {
      const mockResult = [{"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}];
      mockJq.run.mockResolvedValueOnce(mockResult);
      await processor.loadJsonDataset('test.json', '.items');
      
      // Initial status
      let status = processor.getProcessingStatus();
      expect(status.current_record).toBe(0);
      expect(status.remaining).toBe(4);
      expect(status.completed).toBe(0);
      
      // After processing 2 records with 1 result saved
      processor.getNextRecord();
      processor.saveResult('Result 1');
      processor.getNextRecord();
      
      status = processor.getProcessingStatus();
      expect(status.current_record).toBe(2);
      expect(status.remaining).toBe(2);
      expect(status.completed).toBe(1);
      
      // After completing all records with 2 results saved
      processor.getNextRecord();
      processor.saveResult('Result 3');
      processor.getNextRecord();
      
      status = processor.getProcessingStatus();
      expect(status.current_record).toBe(4);
      expect(status.remaining).toBe(0);
      expect(status.completed).toBe(2);
    });
  });
});
