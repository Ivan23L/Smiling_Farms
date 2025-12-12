use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Player {
    pub id: i32,
    pub username: String,
    pub farm_name: String,
    pub level: i32,
    pub experience: i32,
    pub coins: i64,
    pub gems: i32,
    pub energy: i32,
    pub max_energy: i32,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPlayer {
    pub username: String,
    pub email: String,
    pub password: String,
    pub farm_name: String,
}
