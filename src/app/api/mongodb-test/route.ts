import { NextRequest, NextResponse } from 'next/server'
import { connectToMongoDB } from '@/lib/mongodb'

export async function GET() {
  try {
    // Test MongoDB connection
    const connection = await connectToMongoDB()
    const db = connection.db
    
    // Test basic operations
    const testCollection = db.collection('test')
    
    // Insert a test document
    const testDoc = {
      message: 'MongoDB connection test',
      timestamp: new Date(),
      test: true
    }
    
    const insertResult = await testCollection.insertOne(testDoc)
    
    // Retrieve the document
    const retrievedDoc = await testCollection.findOne({ _id: insertResult.insertedId })
    
    // Clean up the test document
    await testCollection.deleteOne({ _id: insertResult.insertedId })
    
    return NextResponse.json({
      success: true,
      mongodb: {
        status: 'connected',
        database: db.databaseName,
        testInsertId: insertResult.insertedId,
        testDocument: retrievedDoc
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}