use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use std::time::Instant;

type HmacSha256 = Hmac<Sha256>;

#[derive(Serialize)]
struct AppHealth {
    status: String,
    app: String,
    note: String,
}

#[derive(Serialize)]
struct HmacBenchmarkResult {
    algorithm: String,
    iterations: u32,
    elapsed_ms: u128,
    sample_signature: String,
    note: String,
}

#[tauri::command]
fn app_health() -> AppHealth {
    AppHealth {
        status: "ok".to_string(),
        app: "soundcare-tauri-control-app".to_string(),
        note: "Tauri Rust command placeholder".to_string(),
    }
}

#[tauri::command]
fn hmac_benchmark(payload: String, iterations: Option<u32>) -> Result<HmacBenchmarkResult, String> {
    let count = iterations.unwrap_or(1_000).clamp(1, 100_000);
    let key = b"development-placeholder-key";
    let started_at = Instant::now();
    let mut last_signature = String::new();

    for _ in 0..count {
        let mut mac = HmacSha256::new_from_slice(key)
            .map_err(|err| format!("HMAC initialization failed: {err}"))?;
        mac.update(payload.as_bytes());
        last_signature = hex::encode(mac.finalize().into_bytes());
    }

    Ok(HmacBenchmarkResult {
        algorithm: "HMAC-SHA256".to_string(),
        iterations: count,
        elapsed_ms: started_at.elapsed().as_millis(),
        sample_signature: last_signature,
        note: "개발용 성능 비교 placeholder입니다. 운영 키 관리 설계가 아닙니다.".to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_health, hmac_benchmark])
        .run(tauri::generate_context!())
        .expect("error while running SoundCare Tauri application");
}

fn main() {
    run();
}
