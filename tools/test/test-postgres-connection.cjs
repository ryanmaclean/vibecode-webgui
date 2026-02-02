const { Client } = require('pg')

async function testPostgresConnection() {
  console.log('Testing postgres user connection...')
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres123',
    database: 'postgres'
  })

  try {
    await client.connect()
    console.log('✅ Connected as postgres successfully')
    
    const result = await client.query('SELECT current_user, current_database')
    console.log('User:', result.rows[0].current_user)
    console.log('Database:', result.rows[0].current_database)
    
    await client.end()
    return true
  } catch (error) {
    console.log('❌ Postgres connection failed:', error.message)
    return false
  }
}

testPostgresConnection()
