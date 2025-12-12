use actix_web::{web, HttpResponse, Responder};
use serde_json::json;

pub async fn init_farm(
    player_id: web::Path<i32>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    
    let player = match pg_client.query_one(
        "SELECT id, username, farm_name, level, experience, coins, gems, energy, max_energy FROM players WHERE id = $1",
        &[&id],
    ).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::NotFound().json("Jugador no encontrado"),
    };
    
    for x in 0..5 {
        for y in 0..5 {
            let _ = pg_client.execute(
                "INSERT INTO plots (player_id, x, y, state) VALUES ($1, $2, $3, 'empty') ON CONFLICT DO NOTHING",
                &[&id, &x, &y],
            ).await;
        }
    }
    
    let plots = match pg_client.query(
        "SELECT id, player_id, x, y, crop_type, planted_at, ready_at, state FROM plots WHERE player_id = $1",
        &[&id],
    ).await {
        Ok(rows) => rows,
        Err(e) => return HttpResponse::InternalServerError().json(format!("Error: {}", e)),
    };
    
    let plots_data: Vec<_> = plots.iter().map(|row| {
        let state: String = row.get(7);
        let ready_at_ts: Option<chrono::NaiveDateTime> = row.get(6);
        
        // Verificar si está listo
        let final_state = if state == "growing" && ready_at_ts.is_some() {
            let now = chrono::Local::now().naive_local();
            if now >= ready_at_ts.unwrap() {
                "ready".to_string()
            } else {
                state
            }
        } else {
            state
        };
        
        json!({
            "id": row.get::<_, i32>(0),
            "x": row.get::<_, i32>(2),
            "y": row.get::<_, i32>(3),
            "crop_type": row.get::<_, Option<String>>(4),
            "planted_at": row.get::<_, Option<chrono::NaiveDateTime>>(5).map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            "ready_at": ready_at_ts.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()),
            "state": final_state,
        })
    }).collect();
    
    HttpResponse::Ok().json(json!({
        "player": {
            "id": player.get::<_, i32>(0),
            "username": player.get::<_, String>(1),
            "farm_name": player.get::<_, String>(2),
            "level": player.get::<_, i32>(3),
            "experience": player.get::<_, i32>(4),
            "coins": player.get::<_, i64>(5),
            "gems": player.get::<_, i32>(6),
            "energy": player.get::<_, i32>(7),
            "max_energy": player.get::<_, i32>(8),
        },
        "plots": plots_data,
    }))
}

pub async fn plant_crop(
    player_id: web::Path<i32>,
    crop_data: web::Json<serde_json::Value>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    let x = crop_data["x"].as_i64().unwrap() as i32;
    let y = crop_data["y"].as_i64().unwrap() as i32;
    let crop_type = crop_data["crop_type"].as_str().unwrap();
    
    let grow_time_minutes = match crop_type {
        "wheat" => 2,
        "carrot" => 5,
        "corn" => 10,
        "potato" => 60,
        _ => 5,
    };
    
    let result = pg_client.execute(
        "UPDATE plots SET crop_type = $1, planted_at = NOW(), ready_at = NOW() + ($2 || ' minutes')::interval, state = 'growing' 
         WHERE player_id = $3 AND x = $4 AND y = $5 AND state = 'empty'",
        &[&crop_type, &grow_time_minutes.to_string(), &id, &x, &y],
    ).await;
    
    match result {
        Ok(rows) if rows > 0 => HttpResponse::Ok().json(json!({
            "success": true,
            "ready_in_minutes": grow_time_minutes
        })),
        _ => HttpResponse::BadRequest().json(json!({"success": false})),
    }
}

pub async fn harvest_crop(
    player_id: web::Path<i32>,
    harvest_data: web::Json<serde_json::Value>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    let x = harvest_data["x"].as_i64().unwrap() as i32;
    let y = harvest_data["y"].as_i64().unwrap() as i32;
    
    println!("🌾 Cosechando ({}, {}) jugador {}", x, y, id);
    
    let plot = match pg_client.query_one(
        "SELECT crop_type, state, ready_at FROM plots WHERE player_id = $1 AND x = $2 AND y = $3",
        &[&id, &x, &y],
    ).await {
        Ok(row) => row,
        Err(e) => {
            println!("❌ Error: {}", e);
            return HttpResponse::NotFound().json(json!({"success": false, "message": "Parcela no encontrada"}));
        }
    };
    
    let crop_type: Option<String> = plot.get(0);
    let state: String = plot.get(1);
    let ready_at: Option<chrono::NaiveDateTime> = plot.get(2);
    
    println!("📊 crop={:?}, state={}, ready_at={:?}", crop_type, state, ready_at);
    
    if crop_type.is_none() {
        return HttpResponse::BadRequest().json(json!({"success": false, "message": "No hay cultivo"}));
    }
    
    // Verificar si está listo
    let is_ready = if state == "ready" {
        true
    } else if ready_at.is_some() {
        let now = chrono::Local::now().naive_local();
        now >= ready_at.unwrap()
    } else {
        false
    };
    
    println!("🕐 is_ready={}", is_ready);
    
    if !is_ready {
        return HttpResponse::BadRequest().json(json!({"success": false, "message": "No está listo"}));
    }
    
    let crop = crop_type.unwrap();
    
    // Añadir al inventario
    let _ = pg_client.execute(
        "INSERT INTO inventory (player_id, item_type, quantity) VALUES ($1, $2, 1)
         ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = inventory.quantity + 1",
        &[&id, &crop],
    ).await;
    
    // Limpiar parcela
    let _ = pg_client.execute(
        "UPDATE plots SET crop_type = NULL, planted_at = NULL, ready_at = NULL, state = 'empty' 
         WHERE player_id = $1 AND x = $2 AND y = $3",
        &[&id, &x, &y],
    ).await;
    
    // Recompensas
    let _ = pg_client.execute(
        "UPDATE players SET experience = experience + 5, coins = coins + 10 WHERE id = $1",
        &[&id],
    ).await;
    
    println!("✅ Cosecha exitosa: {}", crop);
    
    HttpResponse::Ok().json(json!({
        "success": true,
        "item": crop,
        "exp_gained": 5,
        "coins_gained": 10
    }))
}

pub async fn get_inventory(
    player_id: web::Path<i32>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    
    let rows = match pg_client.query(
        "SELECT item_type, quantity FROM inventory WHERE player_id = $1 ORDER BY item_type",
        &[&id],
    ).await {
        Ok(rows) => rows,
        Err(e) => return HttpResponse::InternalServerError().json(format!("Error: {}", e)),
    };
    
    let inventory: Vec<_> = rows.iter().map(|row| {
        json!({
            "item": row.get::<_, String>(0),
            "quantity": row.get::<_, i32>(1),
        })
    }).collect();
    
    HttpResponse::Ok().json(inventory)
}
