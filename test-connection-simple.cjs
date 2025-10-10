const { Client } = require('pg')

async function testConnection() {
  console.log('Testing connection...')
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'vibecode',
    password: 'vibecode123',
    database: 'vibecode',
    connectionTimeoutMillis: 5000
  })

  try {
    await client.connect()
    console.log('✅ Connected successfully')
    
    const result = await client.query('SELECT current_user')
    console.log('User:', result.rows[0].current_user)
    
    await client.end()
  } catch (error) {
    console.log('❌ Connection failed:', error.message)
    console.log('Error code:', error.code)
  }
}

testConnection()
