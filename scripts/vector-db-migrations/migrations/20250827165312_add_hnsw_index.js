/**
 * Migration: Add HNSW index to document_embeddings
 * Created at: 2025-08-27T16:53:12.345Z
 */

module.exports = {
  version: '20250827165312',
  description: 'Add HNSW index to document_embeddings',
  
  /**
   * Run the migration
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   */
  async up(client, _options) {
    console.log('Creating HNSW index on document_embeddings.embedding');
    
    // Set higher maintenance_work_mem for index creation
    await client.$executeRaw`SET maintenance_work_mem = '1GB'`;
    
    // Check if the index already exists
    const indexExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE tablename = 'document_embeddings'
        AND indexname = 'idx_document_embeddings_embedding_hnsw'
      ) as exists
    `;
    
    if (indexExists[0]?.exists) {
      console.log('Index idx_document_embeddings_embedding_hnsw already exists, skipping');
      return;
    }
    
    // Create HNSW index (better for approximate nearest neighbors)
    await client.$executeRaw`
      CREATE INDEX idx_document_embeddings_embedding_hnsw
      ON document_embeddings USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    
    console.log('HNSW index created successfully');
  },
  
  /**
   * Revert the migration
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   */
  async down(client, _options) {
    console.log('Dropping HNSW index from document_embeddings.embedding');
    
    // Check if the index exists
    const indexExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE tablename = 'document_embeddings'
        AND indexname = 'idx_document_embeddings_embedding_hnsw'
      ) as exists
    `;
    
    if (!indexExists[0]?.exists) {
      console.log('Index idx_document_embeddings_embedding_hnsw does not exist, skipping');
      return;
    }
    
    // Drop the index
    await client.$executeRaw`
      DROP INDEX IF EXISTS idx_document_embeddings_embedding_hnsw
    `;
    
    console.log('HNSW index dropped successfully');
  },
  
  /**
   * Validate the migration before running
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   * @returns {boolean} - true if validation passes
   */
  async validate(client, _options) {
    console.log('Validating migration...');
    
    // Check if pgvector is installed
    const pgvectorExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_extension WHERE extname = 'vector'
      ) as exists
    `;
    
    if (!pgvectorExists[0]?.exists) {
      console.error('pgvector extension is not installed');
      return false;
    }
    
    // Check if document_embeddings table exists
    const tableExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'document_embeddings'
      ) as exists
    `;
    
    if (!tableExists[0]?.exists) {
      console.error('document_embeddings table does not exist');
      return false;
    }
    
    // Check if embedding column exists
    const columnExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'embedding'
      ) as exists
    `;
    
    if (!columnExists[0]?.exists) {
      console.error('embedding column does not exist in document_embeddings table');
      return false;
    }
    
    // Validation passed
    return true;
  },
  
  /**
   * Verify the migration after running
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   * @returns {boolean} - true if verification passes
   */
  async verify(client, _options) {
    console.log('Verifying migration...');
    
    // Check if the index exists
    const indexExists = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE tablename = 'document_embeddings'
        AND indexname = 'idx_document_embeddings_embedding_hnsw'
      ) as exists
    `;
    
    if (!indexExists[0]?.exists) {
      console.error('HNSW index was not created successfully');
      return false;
    }
    
    // Verification passed
    return true;
  }
};