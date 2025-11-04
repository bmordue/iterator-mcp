import { DatasetProcessor } from '../src/DatasetProcessor.js';
import { promises as fs } from 'fs';
import path from 'path';

// Simple integration tests focusing on real file processing
describe('Dataset Format Integration Tests', () => {
  let processor: DatasetProcessor;
  const testDataDir = path.join(__dirname, 'data');

  beforeEach(() => {
    processor = new DatasetProcessor();
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(path.join(testDataDir, 'temp_test.json'));
      await fs.unlink(path.join(testDataDir, 'empty.jsonl'));
    } catch (error) {
      // Ignore if files don't exist
    }
  });

  describe('JSONL Format Tests', () => {
    test('should process employee JSONL data correctly', async () => {
      const jsonlPath = path.join(testDataDir, 'test_data.jsonl');
      
      // Load JSONL dataset
      const recordCount = await processor.loadDataset(jsonlPath);
      expect(recordCount).toBeGreaterThan(0);

      // Process first record
      const firstRecord = processor.getNextRecord();
      expect(firstRecord).not.toBeNull();
      expect(firstRecord?.record).toHaveProperty('name');
      expect(firstRecord?.record).toHaveProperty('email');
      expect(firstRecord?.record).toHaveProperty('department');
      
      // Save processing result
      processor.saveResult(`Analyzed employee: ${firstRecord?.record.name}`);
      
      // Check status
      const status = processor.getProcessingStatus();
      expect(status.completed).toBe(1);
      expect(status.current_record).toBe(1);
    });

    test('should handle products JSONL with filtering logic', async () => {
      const productsPath = path.join(testDataDir, 'products.jsonl');
      
      await processor.loadDataset(productsPath);
      
      // Simulate filtering for in-stock products
      const inStockProducts = [];
      let record;
      while ((record = processor.getNextRecord()) !== null) {
        if (record.record.in_stock) {
          inStockProducts.push(record.record);
          processor.saveResult(`Product ${record.record.name} is in stock - price: $${record.record.price}`);
        }
      }
      
      expect(inStockProducts.length).toBeGreaterThan(0);
      expect(processor.getProcessingStatus().completed).toBe(inStockProducts.length);
    });

    test('should handle malformed JSONL gracefully', async () => {
      // Create test file with mixed valid/invalid JSON lines
      const testFile = path.join(testDataDir, 'mixed.jsonl');
      const content = `{"id": 1, "name": "Valid 1"}
invalid json line
{"id": 2, "name": "Valid 2"}
{malformed: json}
{"id": 3, "name": "Valid 3"}`;
      
      await fs.writeFile(testFile, content);
      
      try {
        const count = await processor.loadDataset(testFile);
        expect(count).toBe(3); // Should only count valid lines
        
        // Should be able to process valid records
        const firstRecord = processor.getNextRecord();
        expect(firstRecord?.record.name).toBe('Valid 1');
        
        const secondRecord = processor.getNextRecord();
        expect(secondRecord?.record.name).toBe('Valid 2');
        
        const thirdRecord = processor.getNextRecord();
        expect(thirdRecord?.record.name).toBe('Valid 3');
        
        // No more records
        expect(processor.getNextRecord()).toBeNull();
      } finally {
        await fs.unlink(testFile);
      }
    });
  });

  describe('Navigation and Control Tests', () => {
    beforeEach(async () => {
      await processor.loadDataset(path.join(testDataDir, 'products.jsonl'));
    });

    test('should navigate through dataset correctly', async () => {
      const totalRecords = processor.getProcessingStatus().total_records;
      expect(totalRecords).toBeGreaterThan(0);
      
      // Test sequential processing
      let processedCount = 0;
      let record;
      while ((record = processor.getNextRecord()) !== null) {
        expect(record.record_number).toBe(processedCount + 1);
        expect(record.total_records).toBe(totalRecords);
        processedCount++;
      }
      
      expect(processedCount).toBe(totalRecords);
      expect(processor.hasMoreRecords()).toBe(false);
    });

    test('should reset and jump correctly', async () => {
      // Get first record
      const firstRecord = processor.getNextRecord();
      expect(firstRecord?.record_number).toBe(1);
      
      // Advance to third record
      processor.getNextRecord(); // 2nd record
      const thirdRecord = processor.getNextRecord(); // 3rd record
      expect(thirdRecord?.record_number).toBe(3);
      
      // Reset to start
      processor.resetToStart();
      expect(processor.getProcessingStatus().current_record).toBe(0);
      
      // Should get first record again
      const resetRecord = processor.getNextRecord();
      expect(resetRecord?.record_number).toBe(1);
      expect(resetRecord?.record.id).toBe(firstRecord?.record.id);
    });

    test('should jump to specific record', async () => {
      const totalRecords = processor.getProcessingStatus().total_records;
      
      if (totalRecords >= 3) {
        // Jump to 3rd record (index 2)
        const jumpSuccess = processor.jumpToRecord(2);
        expect(jumpSuccess).toBe(true);
        
        const record = processor.getNextRecord();
        expect(record?.record_number).toBe(3);
        
        // Test invalid jumps
        expect(processor.jumpToRecord(-1)).toBe(false);
        expect(processor.jumpToRecord(totalRecords)).toBe(false);
        expect(processor.jumpToRecord(totalRecords + 10)).toBe(false);
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle non-existent files gracefully', async () => {
      await expect(processor.loadDataset('nonexistent.jsonl'))
        .rejects.toThrow('Failed to load dataset');
      
      await expect(processor.loadJsonDataset('nonexistent.json', '.data'))
        .rejects.toThrow('Failed to load JSON dataset');
    });

    test('should handle invalid JSON files', async () => {
      const invalidJsonPath = path.join(testDataDir, 'invalid.json');
      
      await expect(processor.loadJsonDataset(invalidJsonPath, '.data'))
        .rejects.toThrow('Failed to load JSON dataset');
    });

    test('should handle empty datasets', async () => {
      // Create empty JSONL file
      const emptyJsonlPath = path.join(testDataDir, 'empty.jsonl');
      await fs.writeFile(emptyJsonlPath, '');
      
      try {
        const count = await processor.loadDataset(emptyJsonlPath);
        expect(count).toBe(0);
        
        const record = processor.getNextRecord();
        expect(record).toBeNull();
        expect(processor.hasMoreRecords()).toBe(false);
        
        const status = processor.getProcessingStatus();
        expect(status.total_records).toBe(0);
        expect(status.remaining).toBe(0);
      } finally {
        await fs.unlink(emptyJsonlPath);
      }
    });
  });

  describe('Results and Export Tests', () => {
    test('should track processing results correctly', async () => {
      await processor.loadDataset(path.join(testDataDir, 'products.jsonl'));
      
      // Process records and save results
      const results = [];
      for (let i = 0; i < 3; i++) {
        const record = processor.getNextRecord();
        if (record) {
          const result = `Processed product ${i + 1}: ${record.record.name} - $${record.record.price}`;
          processor.saveResult(result);
          results.push(result);
        }
      }
      
      const status = processor.getProcessingStatus();
      expect(status.completed).toBe(3);
      expect(status.current_record).toBe(3);
      expect(status.remaining).toBe(status.total_records - 3);
    });

    test('should export processing results correctly', async () => {
      await processor.loadDataset(path.join(testDataDir, 'products.jsonl'));
      
      // Process a few records with results
      const expectedResults = [];
      for (let i = 0; i < 2; i++) {
        const record = processor.getNextRecord();
        if (record) {
          const result = `Analysis for product ${record.record.name}: Category ${record.record.category}`;
          processor.saveResult(result);
          expectedResults.push(result);
        }
      }
      
      // Export results
      const exportPath = path.join(testDataDir, 'temp_test.json');
      await processor.exportResults(exportPath);
      
      // Verify export
      const exportedContent = await fs.readFile(exportPath, 'utf-8');
      const results = JSON.parse(exportedContent);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('record_index', 0);
      expect(results[0]).toHaveProperty('result', expectedResults[0]);
      expect(results[1]).toHaveProperty('record_index', 1);
      expect(results[1]).toHaveProperty('result', expectedResults[1]);
    });

    test('should clear results when loading new dataset', async () => {
      // Load first dataset and save results
      await processor.loadDataset(path.join(testDataDir, 'products.jsonl'));
      processor.getNextRecord();
      processor.saveResult('First dataset result');
      
      expect(processor.getProcessingStatus().completed).toBe(1);
      
      // Load new dataset
      await processor.loadDataset(path.join(testDataDir, 'test_data.jsonl'));
      
      // Results should be cleared
      expect(processor.getProcessingStatus().completed).toBe(0);
    });
  });
});
