// Test database connection
const { Client } = require('pg')

async function testConnection() {
  console.log('Testing database connection...')
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'vibecode',
    password: 'vibecode123',
    database: 'vibecode'
  })

  try {
    await client.connect()
    console.log('✅ Connected successfully')
    
    const result = await client.query('SELECT current_user, current_database')
    console.log('User:', result.rows[0].current_user)
    console.log('Database:', result.rows[0].current_database)
    
    await client.end()
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testConnection()
