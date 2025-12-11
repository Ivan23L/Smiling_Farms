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
    // Crear tabla usuarios si no existe
    client.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        &[],
    ).await?;
    
    println!("✓ Base de datos inicializada");
    Ok(())
}
