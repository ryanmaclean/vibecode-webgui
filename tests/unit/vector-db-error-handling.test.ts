import { VectorDbError, VectorDbErrorType, handleVectorDBError } from '../../src/lib/vector-db/vector-db-error-handler';

  describe('Performance', () => {
    test('Error handling has minimal overhead', () => {
      const iterations = 1000;
      
      // Measure time to create errors directly
      const startDirect = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          throw new Error(`Test error ${i}`);
        } catch (error) {
          // Do nothing, just catch
        }
      }
      const endDirect = performance.now();
      const directTime = endDirect - startDirect;
      
      // Measure time with error handler
      const startHandler = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          throw new Error(`Test error ${i}`);
        } catch (error) {
          handleVectorDBError(error, 'testOperation', 'test-provider');
        }
      }
      const endHandler = performance.now();
      const handlerTime = endHandler - startHandler;
      
      console.log(`Direct error handling: ${directTime.toFixed(2)}ms`);
      console.log(`With error handler: ${handlerTime.toFixed(2)}ms`);
      console.log(`Overhead per error: ${((handlerTime - directTime) / iterations).toFixed(3)}ms`);
      
      // The overhead should be reasonable - less than 5ms per error (5x the iterations)
      expect(handlerTime - directTime).toBeLessThan(iterations * 5);
    });
  });