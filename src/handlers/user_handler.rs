use actix_web::{web, HttpResponse, Responder};
use redis::Commands;
use crate::models::user::{User, CreateUser};

pub async fn get_users(pg_client: web::Data<tokio_postgres::Client>) -> impl Responder {
    let rows = match pg_client.query("SELECT id, name, email, created_at::text FROM users", &[]).await {
        Ok(rows) => rows,
        Err(e) => return HttpResponse::InternalServerError().json(format!("Error: {}", e)),
    };
    
    let users: Vec<User> = rows.iter().map(|row| User {
        id: Some(row.get(0)),
        name: row.get(1),
        email: row.get(2),
        created_at: row.get(3),
    }).collect();
    
    HttpResponse::Ok().json(users)
}

pub async fn get_user(
    user_id: web::Path<i32>,
    pg_client: web::Data<tokio_postgres::Client>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    let id = user_id.into_inner();
    let cache_key = format!("user:{}", id);
    
    if let Ok(mut con) = redis_client.get_connection() {
        if let Ok(cached_data) = con.get::<_, String>(&cache_key) {
            println!("✓ Usuario {} obtenido desde caché Redis", id);
            return HttpResponse::Ok()
                .content_type("application/json")
                .body(cached_data);
        }
    }
    
    let row = match pg_client.query_one(
        "SELECT id, name, email, created_at::text FROM users WHERE id = $1",
        &[&id],
    ).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::NotFound().json("Usuario no encontrado"),
    };
    
    let user = User {
        id: Some(row.get(0)),
        name: row.get(1),
        email: row.get(2),
        created_at: row.get(3),
    };
    
    let user_json = serde_json::to_string(&user).unwrap();
    if let Ok(mut con) = redis_client.get_connection() {
        let _: Result<(), _> = con.set_ex(&cache_key, &user_json, 3600);
        println!("✓ Usuario {} guardado en caché Redis", id);
    }
    
    HttpResponse::Ok().json(user)
}

pub async fn create_user(
    user_data: web::Json<CreateUser>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let row = match pg_client.query_one(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at::text",
        &[&user_data.name, &user_data.email],
    ).await {
        Ok(row) => row,
        Err(e) => return HttpResponse::BadRequest().json(format!("Error: {}", e)),
    };
    
    let user = User {
        id: Some(row.get(0)),
        name: row.get(1),
        email: row.get(2),
        created_at: row.get(3),
    };
    
    HttpResponse::Created().json(user)
}

pub async fn delete_user(
    user_id: web::Path<i32>,
    pg_client: web::Data<tokio_postgres::Client>,
    redis_client: web::Data<redis::Client>,
) -> impl Responder {
    let id = user_id.into_inner();
    
    match pg_client.execute("DELETE FROM users WHERE id = $1", &[&id]).await {
        Ok(rows) if rows > 0 => {
            if let Ok(mut con) = redis_client.get_connection() {
                let _: Result<(), _> = con.del(format!("user:{}", id));
            }
            HttpResponse::Ok().json("Usuario eliminado")
        },
        Ok(_) => HttpResponse::NotFound().json("Usuario no encontrado"),
        Err(e) => HttpResponse::InternalServerError().json(format!("Error: {}", e)),
    }
}
