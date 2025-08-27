import { describe, it, expect } from 'vitest';
import { 
  CommandIntentSchema
} from '../../../../src/modules/core/schemas/intent-schemas';

describe('Intent Schemas', () => {
  describe('CommandIntentSchema', () => {
    it('should validate valid create file intent', () => {
      const validIntent = {
        type: 'create_file',
        path: 'test.txt',
        overwrite: false,
        reasoning: 'Creating test file'
      };
      
      const result = CommandIntentSchema.safeParse(validIntent);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.type).toBe('create_file');
        expect(result.data.path).toBe('test.txt');
        expect(result.data.overwrite).toBe(false);
      }
    });
    
    it('should validate basic intent types', () => {
      // Test only the simple successful cases
      const simpleIntents = [
        { type: 'undo', reasoning: 'test' },
        { type: 'help', reasoning: 'test' }
      ];
      
      for (const intent of simpleIntents) {
        const result = CommandIntentSchema.safeParse(intent);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Validation edge cases', () => {
    it('should reject invalid intent types', () => {
      const invalidIntent = {
        type: 'invalid_type',
        path: 'test.txt'
      };
      
      const result = CommandIntentSchema.safeParse(invalidIntent);
      expect(result.success).toBe(false);
    });

    it('should handle various path formats', () => {
      const pathTests = [
        'simple.txt',
        'folder/file.txt',
        'файл.txt' // Cyrillic filename
      ];
      
      for (const path of pathTests) {
        const intent = {
          type: 'create_file',
          path,
          overwrite: false,
          reasoning: 'test path format'
        };
        
        const result = CommandIntentSchema.safeParse(intent);
        if (!result.success) {
          console.log('Failed path:', path, 'Errors:', result.error.issues);
        }
        expect(result.success).toBe(true);
      }
    });
  });
});
