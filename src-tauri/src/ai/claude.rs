// MixMind — Claude API Client
// Implements streaming chat via Anthropic's Messages API.
// Emits Tauri events "ai-token" for each text delta.

use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_TOKENS: u32 = 2048;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role:    String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ApiRequest<'a> {
    model:      &'a str,
    max_tokens: u32,
    system:     &'a str,
    messages:   &'a [Message],
    stream:     bool,
}

/// Stream a chat request to Claude API.
/// Emits "ai-token" events for each text delta.
/// Returns the full accumulated response text.
pub async fn stream_chat(
    app: &AppHandle,
    api_key: &str,
    model: &str,
    system: &str,
    messages: &[Message],
) -> Result<String> {
    let client = reqwest::Client::new();

    let mut headers = HeaderMap::new();
    headers.insert("x-api-key", HeaderValue::from_str(api_key)
        .map_err(|_| anyhow!("Invalid API key format"))?);
    headers.insert("anthropic-version",
        HeaderValue::from_static(ANTHROPIC_VERSION));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let request_body = ApiRequest {
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        stream: true,
    };

    let response = client
        .post(CLAUDE_API_URL)
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
                    if data == "[DONE]" { break; }

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(delta_text) = parsed
                            .get("delta")
                            .and_then(|d| d.get("text"))
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

    Ok(full_text)
}
