use tokio_postgres::{Client, NoTls, Error};

pub async fn get_client() -> Result<Client, Error> {
    let db_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL debe estar en .env");
    
    let (client, connection) = tokio_postgres::connect(&db_url, NoTls).await?;
    
    // Ejecutar conexión en segundo plano
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Error de conexión PostgreSQL: {}", e);
        }
    });
    
    Ok(client)
}

pub async fn init_db(client: &Client) -> Result<(), Error> {
    // Tabla de jugadores
    client.execute(
        "CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            farm_name VARCHAR(50) NOT NULL,
            level INT DEFAULT 1,
            experience INT DEFAULT 0,
            coins BIGINT DEFAULT 500,
            gems INT DEFAULT 10,
            energy INT DEFAULT 100,
            max_energy INT DEFAULT 100,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        &[],
    ).await?;
    
    // Tabla de parcelas (plots)
    client.execute(
        "CREATE TABLE IF NOT EXISTS plots (
            id SERIAL PRIMARY KEY,
            player_id INT REFERENCES players(id) ON DELETE CASCADE,
            x INT NOT NULL,
            y INT NOT NULL,
            crop_type VARCHAR(50),
            planted_at TIMESTAMP,
            ready_at TIMESTAMP,
            state VARCHAR(20) DEFAULT 'empty',
            UNIQUE(player_id, x, y)
        )",
        &[],
    ).await?;
    
    // Tabla de inventario (granero)
    client.execute(
        "CREATE TABLE IF NOT EXISTS inventory (
            id SERIAL PRIMARY KEY,
            player_id INT REFERENCES players(id) ON DELETE CASCADE,
            item_type VARCHAR(50) NOT NULL,
            quantity INT DEFAULT 0,
            UNIQUE(player_id, item_type)
        )",
        &[],
    ).await?;
    
    // Tabla de edificios
    client.execute(
        "CREATE TABLE IF NOT EXISTS buildings (
            id SERIAL PRIMARY KEY,
            player_id INT REFERENCES players(id) ON DELETE CASCADE,
            building_type VARCHAR(50) NOT NULL,
            x INT NOT NULL,
            y INT NOT NULL,
            level INT DEFAULT 1,
            state VARCHAR(20) DEFAULT 'idle',
            UNIQUE(player_id, x, y)
        )",
        &[],
    ).await?;
    
    // Tabla de animales
    client.execute(
        "CREATE TABLE IF NOT EXISTS animals (
            id SERIAL PRIMARY KEY,
            player_id INT REFERENCES players(id) ON DELETE CASCADE,
            animal_type VARCHAR(50) NOT NULL,
            x INT NOT NULL,
            y INT NOT NULL,
            state VARCHAR(20) DEFAULT 'hungry',
            last_fed TIMESTAMP,
            next_production TIMESTAMP,
            UNIQUE(player_id, x, y)
        )",
        &[],
    ).await?;
    
    println!("✓ Base de datos de Smiling Farms inicializada");
    Ok(())
}
