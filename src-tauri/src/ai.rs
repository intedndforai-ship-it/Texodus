use futures_util::StreamExt;
use reqwest::{Client, RequestBuilder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

// Share a single reqwest Client across all AI calls.
static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| Client::new())
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChunkResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    delta: Delta,
}

#[derive(Deserialize)]
struct Delta {
    content: Option<String>,
}

#[derive(Clone, Serialize)]
struct StreamPayload {
    provider: String,
    text: String,
    is_done: bool,
}

// A generic function to handle OpenAI-compatible streaming
async fn stream_openai_compatible(
    app: AppHandle,
    provider: &str,
    req: RequestBuilder,
) -> Result<(), String> {
    let mut response = req.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("API Error: {}", err_text));
    }

    let mut stream = response.bytes_stream();
    let provider_str = provider.to_string();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        // SSE chunks look like: `data: {"id": "...", "choices": [{"delta": {"content": "hello"}}]}\n\n`
        for line in text.lines() {
            let line = line.trim();
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    continue;
                }
                
                if let Ok(parsed) = serde_json::from_str::<ChunkResponse>(data) {
                    if let Some(choice) = parsed.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            let _ = app.emit("ai-chunk", StreamPayload {
                                provider: provider_str.clone(),
                                text: content.clone(),
                                is_done: false,
                            });
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit("ai-chunk", StreamPayload {
        provider: provider_str,
        text: String::new(),
        is_done: true,
    });

    Ok(())
}

#[tauri::command]
pub async fn ai_generate_mistral(
    app: AppHandle,
    api_key: String,
    system_prompt: String,
    user_prompt: String,
) -> Result<(), String> {
    let client = get_client();
    let req = client
        .post("https://api.mistral.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&json!({
            "model": "mistral-large-latest",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": true
        }));

    stream_openai_compatible(app, "mistral", req).await
}

#[tauri::command]
pub async fn ai_generate_nemotron(
    app: AppHandle,
    api_key: String,
    system_prompt: String,
    user_prompt: String,
) -> Result<(), String> {
    // OpenRouter endpoint
    let client = get_client();
    let req = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/w512/Texodus")
        .header("X-Title", "Texodus")
        .json(&json!({
            "model": "nvidia/llama-3.1-nemotron-70b-instruct",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": true
        }));

    stream_openai_compatible(app, "nemotron", req).await
}

#[tauri::command]
pub async fn ai_generate_glm(
    app: AppHandle,
    api_key: String,
    system_prompt: String,
    user_prompt: String,
) -> Result<(), String> {
    // ZhipuAI / OpenRouter endpoint
    let client = get_client();
    let req = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/w512/Texodus")
        .header("X-Title", "Texodus")
        .json(&json!({
            "model": "zhipu/glm-4-plus",
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": true
        }));

    stream_openai_compatible(app, "glm", req).await
}

#[tauri::command]
pub async fn ai_test_connection(provider: String, api_key: String) -> Result<bool, String> {
    let client = get_client();
    let res = match provider.as_str() {
        "mistral" => {
            client
                .get("https://api.mistral.ai/v1/models")
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
        }
        "nemotron" | "glm" => {
            client
                .post("https://openrouter.ai/api/v1/auth/key")
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
        }
        _ => return Err("Unknown provider".into()),
    };

    match res {
        Ok(r) => Ok(r.status().is_success()),
        Err(e) => Err(e.to_string()),
    }
}
