// MixMind — OpenAI API Client (Local LLMs)
// Implements streaming chat via OpenAI-compatible endpoints (Ollama, LM Studio, etc.).
// Emits Tauri events "ai-token" for each text delta.

use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::ai::claude::Message; // Reuse the Message struct

const MAX_TOKENS: u32 = 1024;

#[derive(Debug, Serialize)]
struct ApiRequest<'a> {
    model:      &'a str,
    max_tokens: u32,
    messages:   Vec<Message>,
    stream:     bool,
}

/// Stream a chat request to an OpenAI-compatible API.
/// Emits "ai-token" events for each text delta.
/// Returns the full accumulated response text.
pub async fn stream_chat(
    app: &AppHandle,
    api_url: &str,
    api_key: Option<&str>,
    model: &str,
    system: &str,
    messages: &[Message],
) -> Result<String> {
    let client = reqwest::Client::new();

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    
    if let Some(key) = api_key {
        if !key.is_empty() {
            let auth_val = format!("Bearer {}", key);
            if let Ok(val) = HeaderValue::from_str(&auth_val) {
                headers.insert(AUTHORIZATION, val);
            }
        }
    }

    let mut api_messages = vec![Message {
        role: "system".to_string(),
        content: system.to_string(),
    }];
    api_messages.extend_from_slice(messages);

    // Make sure url ends with /chat/completions
    let endpoint = if api_url.ends_with("/chat/completions") {
        api_url.to_string()
    } else if api_url.ends_with('/') {
        format!("{}chat/completions", api_url)
    } else {
        format!("{}/chat/completions", api_url)
    };

    let request_body = ApiRequest {
        model,
        max_tokens: MAX_TOKENS,
        messages: api_messages,
        stream: true,
    };

    let response = client
        .post(&endpoint)
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| anyhow!("Request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow!("API error {}: {}", status, body));
    }

    // Stream SSE response
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut full_text = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| anyhow!("Stream error: {e}"))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        // Process complete SSE events (split by double newline)
        while let Some(pos) = buffer.find("\n\n") {
            let event = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            for line in event.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    if data.trim() == "[DONE]" { break; }

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = parsed.get("choices").and_then(|c| c.as_array()) {
                            if let Some(first_choice) = choices.get(0) {
                                if let Some(delta_text) = first_choice
                                    .get("delta")
                                    .and_then(|d| d.get("content"))
                                    .and_then(|t| t.as_str())
                                {
                                    full_text.push_str(delta_text);
                                    let _ = app.emit("ai-token", serde_json::json!({
                                        "text": delta_text
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(full_text)
}
