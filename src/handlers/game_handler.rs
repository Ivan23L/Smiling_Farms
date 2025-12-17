use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use rand::Rng;
use chrono::{NaiveDateTime, Local}; // ya usas chrono::Local más abajo


#[derive(Serialize)]
struct LevelUpReward {
    gems: i32,
    max_energy_increase: i32,
    unlocked_crops: Vec<String>,
    random_item: String,
}

#[derive(Deserialize)]
pub struct SellRequest {
    item_type: String,
    quantity: i32,
}
#[derive(Deserialize)]
pub struct BuildRequest {
    pub structure_type: String, // "plot" | "cow_barn"
    pub x: i32,
    pub y: i32,
}


fn calculate_xp_for_level(level: i32) -> i32 {
    (100.0 * (level as f64).powf(1.5)) as i32
}

fn get_seed_cost(crop_type: &str) -> i32 {
    match crop_type {
        "wheat" => 0,
        "carrot" => 0,
        "corn" => 1,
        "potato" => 2,
        _ => 0,
    }
}

fn get_crop_sell_price(crop_type: &str) -> i32 {
    match crop_type {
        "wheat" => 3,
        "carrot" => 7,
        "corn" => 15,
        "potato" => 30,
        _ => 1,
    }
}

fn get_crop_xp(crop_type: &str) -> i32 {
    match crop_type {
        "wheat" => 3,
        "carrot" => 8,
        "corn" => 18,
        "potato" => 40,
        _ => 1,
    }
}

fn get_unlocked_crops_by_level(level: i32) -> Vec<String> {
    let mut crops = vec!["wheat".to_string()];
    
    if level >= 2 {
        crops.push("carrot".to_string());
    }
    if level >= 5 {
        crops.push("corn".to_string());
    }
    if level >= 10 {
        crops.push("potato".to_string());
    }
    
    crops
}

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
    
    let player_level: i32 = player.get(3);
    let player_xp: i32 = player.get(4);
    let unlocked_crops = get_unlocked_crops_by_level(player_level);
    let xp_needed = calculate_xp_for_level(player_level + 1);
    
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
            "level": player_level,
            "experience": player_xp,
            "xp_needed": xp_needed,
            "coins": player.get::<_, i64>(5),
            "gems": player.get::<_, i32>(6),
            "energy": player.get::<_, i32>(7),
            "max_energy": player.get::<_, i32>(8),
        },
        "plots": plots_data,
        "unlocked_crops": unlocked_crops,
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
    
    // Verificar si el jugador tiene suficiente dinero
    let player = match pg_client.query_one(
        "SELECT coins FROM players WHERE id = $1",
        &[&id],
    ).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::InternalServerError().json(json!({"success": false, "error": "Player not found"})),
    };
    
    let current_coins: i64 = player.get(0);
    let seed_cost = get_seed_cost(crop_type) as i64;
    
    if current_coins < seed_cost {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "not_enough_money",
            "cost": seed_cost,
            "current": current_coins
        }));
    }
    
    let grow_time_minutes = match crop_type {
        "wheat" => 2,
        "carrot" => 5,
        "corn" => 10,
        "potato" => 60,
        _ => 5,
    };
    
    // Plantar cultivo
    let result = pg_client.execute(
        "UPDATE plots SET crop_type = $1, planted_at = NOW(), ready_at = NOW() + ($2 || ' minutes')::interval, state = 'growing' 
         WHERE player_id = $3 AND x = $4 AND y = $5 AND state = 'empty'",
        &[&crop_type, &grow_time_minutes.to_string(), &id, &x, &y],
    ).await;
    
    match result {
        Ok(rows) if rows > 0 => {
            // Cobrar la semilla (solo si cuesta algo)
            if seed_cost > 0 {
                let _ = pg_client.execute(
                    "UPDATE players SET coins = coins - $1 WHERE id = $2",
                    &[&seed_cost, &id],
                ).await;
            }
            
            HttpResponse::Ok().json(json!({
                "success": true,
                "ready_in_minutes": grow_time_minutes,
                "cost": seed_cost
            }))
        },
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
    
    let plot = match pg_client.query_one(
        "SELECT crop_type, state, ready_at FROM plots WHERE player_id = $1 AND x = $2 AND y = $3",
        &[&id, &x, &y],
    ).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::NotFound().json(json!({"success": false})),
    };
    
    let crop_type: Option<String> = plot.get(0);
    let state: String = plot.get(1);
    let ready_at: Option<chrono::NaiveDateTime> = plot.get(2);
    
    if crop_type.is_none() {
        return HttpResponse::BadRequest().json(json!({"success": false}));
    }
    
    let is_ready = if state == "ready" {
        true
    } else if ready_at.is_some() {
        let now = chrono::Local::now().naive_local();
        now >= ready_at.unwrap()
    } else {
        false
    };
    
    if !is_ready {
        return HttpResponse::BadRequest().json(json!({"success": false}));
    }
    
    let crop = crop_type.unwrap();
    let exp_gained = get_crop_xp(&crop);
    
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
    
    // Obtener datos del jugador
    let player = match pg_client.query_one(
        "SELECT level, experience, max_energy FROM players WHERE id = $1",
        &[&id],
    ).await {
        Ok(row) => row,
        Err(_) => return HttpResponse::InternalServerError().json(json!({"success": false})),
    };
    
    let current_level: i32 = player.get(0);
    let current_xp: i32 = player.get(1);
    let current_max_energy: i32 = player.get(2);
    let new_xp = current_xp + exp_gained;
    let xp_needed = calculate_xp_for_level(current_level + 1);
    
    let mut leveled_up = false;
    let mut new_level = current_level;
    let mut final_xp = new_xp;
    let mut level_up_reward: Option<LevelUpReward> = None;
    
    if new_xp >= xp_needed {
        new_level = current_level + 1;
        final_xp = new_xp - xp_needed;
        leveled_up = true;
        
        // Generar recompensas
        let mut rng = rand::thread_rng();
        let gems_reward = rng.gen_range(2..=3);
        let max_energy_increase = 5;
        let new_max_energy = current_max_energy + max_energy_increase;
        
        let random_items = vec!["💎 Gema", "⚡ Energía", "🌟 Estrella", "🎁 Regalo"];
        let random_item = random_items[rng.gen_range(0..random_items.len())].to_string();
        
        let unlocked_crops = get_unlocked_crops_by_level(new_level);
        let prev_unlocked = get_unlocked_crops_by_level(current_level);
        let newly_unlocked: Vec<String> = unlocked_crops.into_iter()
            .filter(|c| !prev_unlocked.contains(c))
            .collect();
        
        // Actualizar jugador con nuevo nivel (SIN DAR MONEDAS)
        let _ = pg_client.execute(
            "UPDATE players SET experience = $1, level = $2, gems = gems + $3, max_energy = $4, energy = $4 WHERE id = $5",
            &[&final_xp, &new_level, &gems_reward, &new_max_energy, &id],
        ).await;
        
        level_up_reward = Some(LevelUpReward {
            gems: gems_reward,
            max_energy_increase,
            unlocked_crops: newly_unlocked,
            random_item,
        });
    } else {
        // Solo actualizar XP (SIN DAR MONEDAS)
        let _ = pg_client.execute(
            "UPDATE players SET experience = $1 WHERE id = $2",
            &[&final_xp, &id],
        ).await;
    }
    
    HttpResponse::Ok().json(json!({
        "success": true,
        "item": crop,
        "exp_gained": exp_gained,
        "leveled_up": leveled_up,
        "new_level": new_level,
        "level_up_reward": level_up_reward,
    }))
}

pub async fn sell_item(
    player_id: web::Path<i32>,
    sell_data: web::Json<SellRequest>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    let item_type = &sell_data.item_type;
    let quantity = sell_data.quantity;
    
    let price_per_unit = get_crop_sell_price(item_type) as i64;
    let total_price = price_per_unit * quantity as i64;
    
    let result = pg_client.execute(
        "UPDATE inventory SET quantity = quantity - $1 WHERE player_id = $2 AND item_type = $3 AND quantity >= $1",
        &[&quantity, &id, &item_type],
    ).await;
    
    match result {
        Ok(rows) if rows > 0 => {
            let _ = pg_client.execute(
                "UPDATE players SET coins = coins + $1 WHERE id = $2",
                &[&total_price, &id],
            ).await;
            
            let _ = pg_client.execute(
                "DELETE FROM inventory WHERE player_id = $1 AND quantity <= 0",
                &[&id],
            ).await;
            
            HttpResponse::Ok().json(json!({
                "success": true,
                "coins_earned": total_price
            }))
        },
        _ => HttpResponse::BadRequest().json(json!({"success": false})),
    }
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
    
    HttpResponse::Ok().json(inventory)}
    // Construir estructuras: parcelas nuevas o establos de vacas
pub async fn build_structure(
    player_id: web::Path<i32>,
    build_data: web::Json<BuildRequest>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();
    let structure_type = build_data.structure_type.as_str();
    let x = build_data.x;
    let y = build_data.y;

    // 1) Coste y nivel mínimo por tipo
    let (cost, min_level) = match structure_type {
        "plot" => (50_i64, 1_i32),
        "cow_barn" => (250_i64, 4_i32),
        _ => {
            return HttpResponse::BadRequest().json(json!({
                "success": false,
                "error": "unknown_structure"
            }))
        }
    };

    // 2) Cargar jugador (coins + level)
    let player_row = match pg_client
        .query_one(
            "SELECT level, coins FROM players WHERE id = $1",
            &[&id],
        )
        .await
    {
        Ok(row) => row,
        Err(_) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": "player_not_found"
            }))
        }
    };

    let player_level: i32 = player_row.get(0);
    let current_coins: i64 = player_row.get(1);

    if player_level < min_level {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "not_enough_level",
            "required": min_level,
            "current": player_level
        }));
    }

    if current_coins < cost {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "not_enough_money",
            "cost": cost,
            "current": current_coins
        }));
    }

    // 3) Verificar que la casilla está libre (ni plot ni building)
    let occupied_plots = pg_client
        .query(
            "SELECT 1 FROM plots WHERE player_id = $1 AND x = $2 AND y = $3",
            &[&id, &x, &y],
        )
        .await
        .unwrap_or_default();

    if !occupied_plots.is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "tile_occupied"
        }));
    }

    let occupied_buildings = pg_client
        .query(
            "SELECT 1 FROM buildings WHERE player_id = $1 AND x = $2 AND y = $3",
            &[&id, &x, &y],
        )
        .await
        .unwrap_or_default();

    if !occupied_buildings.is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "tile_occupied"
        }));
    }

    // 4) Insertar estructura según tipo
    match structure_type {
        "plot" => {
            let _ = pg_client
                .execute(
                    "INSERT INTO plots (player_id, x, y, state) VALUES ($1, $2, $3, 'empty')",
                    &[&id, &x, &y],
                )
                .await;
        }
        "cow_barn" => {
            // Tabla buildings: id SERIAL, player_id, building_type, x, y, ready_at
            let _ = pg_client
                .execute(
                    "INSERT INTO buildings (player_id, building_type, x, y, ready_at)
                     VALUES ($1, 'cow_barn', $2, $3, NOW() + interval '30 minutes')",
                    &[&id, &x, &y],
                )
                .await;
        }
        _ => {}
    }

    // 5) Cobrar monedas
    let _ = pg_client
        .execute(
            "UPDATE players SET coins = coins - $1 WHERE id = $2",
            &[&cost, &id],
        )
        .await;

    // 6) Devolver estado mínimo actualizado (coins + eco simple)
    let player = match pg_client
        .query_one(
            "SELECT id, username, farm_name, level, experience, coins, gems, energy, max_energy
             FROM players WHERE id = $1",
            &[&id],
        )
        .await
    {
        Ok(row) => row,
        Err(_) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "error": "player_reload_failed"
            }))
        }
    };

    HttpResponse::Ok().json(json!({
        "success": true,
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
        }
    }))
}
// Recoger productos de animales (leche de establos)
pub async fn collect_animals(
    player_id: web::Path<i32>,
    pg_client: web::Data<tokio_postgres::Client>,
) -> impl Responder {
    let id = player_id.into_inner();

    // 1) Buscar establos listos: ready_at <= ahora
    let barns = match pg_client
        .query(
            "SELECT id, ready_at FROM buildings
             WHERE player_id = $1 AND building_type = 'cow_barn'",
            &[&id],
        )
        .await
    {
        Ok(rows) => rows,
        Err(e) => {
            return HttpResponse::InternalServerError().json(format!("Error: {}", e))
        }
    };

    let now = Local::now().naive_local();
    let mut total_milk: i32 = 0;

    for barn in &barns {
        let ready_at: Option<NaiveDateTime> = barn.get(1);
        if let Some(ready) = ready_at {
            if now >= ready {
                // Producción por ciclo (p.ej. 5 unidades)
                total_milk += 5;
            }
        }
    }

    if total_milk == 0 {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "error": "no_animals_ready"
        }));
    }

    // 2) Reprogramar siguiente producción de todos los establos listos
    let _ = pg_client
        .execute(
            "UPDATE buildings
             SET ready_at = NOW() + interval '30 minutes'
             WHERE player_id = $1 AND building_type = 'cow_barn' AND ready_at <= NOW()",
            &[&id],
        )
        .await;

    // 3) Añadir leche al inventario como item_type 'milk'
    let _ = pg_client
        .execute(
            "INSERT INTO inventory (player_id, item_type, quantity)
             VALUES ($1, 'milk', $2)
             ON CONFLICT (player_id, item_type)
             DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity",
            &[&id, &total_milk],
        )
        .await;

    // 4) Devolver éxito + cantidad recogida
    HttpResponse::Ok().json(json!({
        "success": true,
        "collected_milk": total_milk
    }))
}

