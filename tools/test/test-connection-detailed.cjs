const { Client } = require('pg')

async function testConnection() {
  console.log('Testing detailed database connection...')
  
  const configs = [
    {
      host: 'localhost',
      port: 5432,
      user: 'vibecode',
      password: 'vibecode123',
      database: 'vibecode'
    },
    {
      host: '127.0.0.1',
      port: 5432,
      user: 'vibecode',
      password: 'vibecode123',
      database: 'vibecode'
    }
  ]

  for (const config of configs) {
    console.log(`\nTrying config: ${JSON.stringify(config)}`)
    
    const client = new Client(config)
    
    try {
      await client.connect()
      console.log('✅ Connected successfully')
      
      const result = await client.query('SELECT current_user, current_database')
      console.log('User:', result.rows[0].current_user)
      console.log('Database:', result.rows[0].current_database)
      
      await client.end()
      return true
    } catch (error) {
      console.log('❌ Connection failed:', error.message)
    }
  }
  
  return false
}

testConnection()
