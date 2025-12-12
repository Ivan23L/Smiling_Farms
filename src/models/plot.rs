use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Plot {
    pub id: i32,
    pub player_id: i32,
    pub x: i32,
    pub y: i32,
    pub crop_type: Option<String>,
    pub planted_at: Option<String>,
    pub ready_at: Option<String>,
    pub state: String, // empty, growing, ready, rotten
}

#[derive(Debug, Deserialize)]
pub struct PlantCrop {
    pub x: i32,
    pub y: i32,
    pub crop_type: String,
}
