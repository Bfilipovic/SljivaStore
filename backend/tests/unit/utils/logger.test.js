// tests/unit/utils/logger.test.js
const logger = require('../../../utils/logger');

describe('Logger Utility', () => {
  describe('logger functions', () => {
    it('should have logInfo function', () => {
      expect(typeof logger.logInfo).toBe('function');
    });

    it('should have logError function', () => {
      expect(typeof logger.logError).toBe('function');
    });

    it('should log messages without throwing', () => {
      expect(() => {
        logger.logInfo('Test message');
        logger.logError('Test error');
      }).not.toThrow();
    });
  });
});
