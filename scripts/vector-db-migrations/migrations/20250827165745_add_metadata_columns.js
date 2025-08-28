/**
 * Migration: Add metadata columns to document_embeddings
 * Created at: 2025-08-27T16:57:45.123Z
 */

module.exports = {
  version: '20250827165745',
  description: 'Add metadata columns to document_embeddings',
  
  /**
   * Run the migration
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   */
  async up(client, _options) {
    console.log('Adding metadata columns to document_embeddings table');
    
    // Check if columns already exist
    const sourceExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'source'
      ) as exists
    `;
    
    const embeddingModelExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'embedding_model'
      ) as exists
    `;
    
    const tagsExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'tags'
      ) as exists
    `;
    
    // Add columns if they don't exist
    if (!sourceExistsResult[0]?.exists) {
      console.log('Adding source column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        ADD COLUMN source VARCHAR(255)
      `;
    } else {
      console.log('source column already exists, skipping');
    }
    
    if (!embeddingModelExistsResult[0]?.exists) {
      console.log('Adding embedding_model column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        ADD COLUMN embedding_model VARCHAR(100)
      `;
    } else {
      console.log('embedding_model column already exists, skipping');
    }
    
    if (!tagsExistsResult[0]?.exists) {
      console.log('Adding tags column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        ADD COLUMN tags TEXT[]
      `;
    } else {
      console.log('tags column already exists, skipping');
    }
    
    console.log('Metadata columns added successfully');
  },
  
  /**
   * Revert the migration
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   */
  async down(client, _options) {
    console.log('Removing metadata columns from document_embeddings table');
    
    // Check if columns exist
    const sourceExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'source'
      ) as exists
    `;
    
    const embeddingModelExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'embedding_model'
      ) as exists
    `;
    
    const tagsExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'tags'
      ) as exists
    `;
    
    // Drop columns if they exist
    if (sourceExistsResult[0]?.exists) {
      console.log('Dropping source column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        DROP COLUMN source
      `;
    } else {
      console.log('source column does not exist, skipping');
    }
    
    if (embeddingModelExistsResult[0]?.exists) {
      console.log('Dropping embedding_model column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        DROP COLUMN embedding_model
      `;
    } else {
      console.log('embedding_model column does not exist, skipping');
    }
    
    if (tagsExistsResult[0]?.exists) {
      console.log('Dropping tags column');
      await client.$executeRaw`
        ALTER TABLE document_embeddings
        DROP COLUMN tags
      `;
    } else {
      console.log('tags column does not exist, skipping');
    }
    
    console.log('Metadata columns removed successfully');
  },
  
  /**
   * Validate the migration before running
   * @param {Object} client - Database client
   * @param {Object} options - Migration options (batchSize, etc.)
   * @returns {boolean} - true if validation passes
   */
  async validate(client, _options) {
    console.log('Validating migration...');
    
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
    
    // Check if columns exist
    const sourceExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'source'
      ) as exists
    `;
    
    const embeddingModelExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'embedding_model'
      ) as exists
    `;
    
    const tagsExistsResult = await client.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'document_embeddings'
        AND column_name = 'tags'
      ) as exists
    `;
    
    if (!sourceExistsResult[0]?.exists) {
      console.error('source column was not added successfully');
      return false;
    }
    
    if (!embeddingModelExistsResult[0]?.exists) {
      console.error('embedding_model column was not added successfully');
      return false;
    }
    
    if (!tagsExistsResult[0]?.exists) {
      console.error('tags column was not added successfully');
      return false;
    }
    
    // Verification passed
    return true;
  }
};