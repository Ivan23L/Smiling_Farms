mod models;
mod handlers;
mod db;

use actix_web::{web, App, HttpServer, middleware};
use actix_files as fs;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Cargar variables de entorno desde .env
    dotenv::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    println!("🚀 Iniciando servidor...");
    
    // Conectar PostgreSQL
    let pg_client = db::postgres::get_client().await
        .expect("Error al conectar con PostgreSQL");
    
    // Inicializar base de datos (crear tablas)
    db::postgres::init_db(&pg_client).await
        .expect("Error al inicializar base de datos");
    
    // Conectar Redis
    let redis_client = db::redis::get_redis_client()
        .expect("Error al conectar con Redis");
    
    // Verificar conexión Redis
    if let Ok(mut con) = redis_client.get_connection() {
        redis::cmd("PING").query::<String>(&mut con)
            .expect("Redis no responde");
        println!("✓ Conectado a Redis");
    }
    
    let pg_data = web::Data::new(pg_client);
    let redis_data = web::Data::new(redis_client);
    
    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);
    
    println!("✓ Servidor corriendo en http://{}", bind_address);
    println!("✓ API disponible en http://{}/api/users", bind_address);
    
    HttpServer::new(move || {
        App::new()
            .app_data(pg_data.clone())
            .app_data(redis_data.clone())
            .wrap(middleware::Logger::default())
            .wrap(actix_cors::Cors::permissive())
            // Rutas API
            .route("/api/users", web::get().to(handlers::user_handler::get_users))
            .route("/api/user/{id}", web::get().to(handlers::user_handler::get_user))
            .route("/api/user", web::post().to(handlers::user_handler::create_user))
            .route("/api/user/{id}", web::delete().to(handlers::user_handler::delete_user))
            // Servir archivos estáticos
            .service(fs::Files::new("/", "./static").index_file("index.html"))
    })
    .bind(bind_address)?
    .run()
    .await
}
