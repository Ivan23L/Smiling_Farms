use redis::{Client, RedisError};

pub fn get_redis_client() -> Result<Client, RedisError> {
    let redis_url = std::env::var("REDIS_URL")
        .expect("REDIS_URL debe estar en .env");
    
    Client::open(redis_url)
}
