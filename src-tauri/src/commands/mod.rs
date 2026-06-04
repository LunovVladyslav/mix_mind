// MixMind — Tauri Commands
// All commands callable from the React frontend via invoke()

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::state::AppState;
use crate::bridge;
use crate::audio::{decoder, analyzer};
use crate::ai::{claude, openai, context, prompts};
use crate::config;

static CANCEL_ANALYSIS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub type AppStateHandle = Arc<Mutex<AppState>>;

/// Get all active channels from shared memory
#[tauri::command]
pub async fn get_channels(
    state: State<'_, AppStateHandle>,
) -> Result<Vec<bridge::ChannelSnapshot>, String> {
    let channels = bridge::get_channels_from_shm().await;
    let mut s = state.lock().await;
    s.channels = channels.clone();
    s.bridge_connected = !channels.is_empty();
    Ok(channels)
}

/// Check if the VST bridge shared memory is accessible
#[tauri::command]
pub async fn is_bridge_connected() -> Result<bool, String> {
    Ok(bridge::is_connected())
}

/// Analyze an audio file (WAV or MP3)
/// Runs on a blocking thread to avoid blocking the async runtime
#[tauri::command]
pub async fn analyze_file(
    app: AppHandle,
    state: State<'_, AppStateHandle>,
    path: String,
) -> Result<analyzer::AnalysisResult, String> {
    let path_clone = path.clone();
    let app_clone = app.clone();

    CANCEL_ANALYSIS.store(false, std::sync::atomic::Ordering::SeqCst);

    // Emit progress: decoding
    let _ = app.emit("analysis-progress", serde_json::json!({
        "stage": "decoding", "pct": 10
    }));

    let result = tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&path_clone);
        let buf = decoder::decode_file(p)
            .map_err(|e| e.to_string())?;

        let _ = app_clone.emit("analysis-progress", serde_json::json!({
            "stage": "fft", "pct": 50
        }));

        let result = analyzer::analyze(&buf)
            .map_err(|e| e.to_string())?;

        let _ = app_clone.emit("analysis-progress", serde_json::json!({
            "stage": "done", "pct": 100
        }));

        Ok::<analyzer::AnalysisResult, String>(result)
    }).await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Store in app state
    let file_name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    if CANCEL_ANALYSIS.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("Analysis cancelled".to_string());
    }

    let mut s = state.lock().await;
    s.file_analysis = Some(result.clone());
    s.file_name = Some(file_name);
    s.clear_messages(); // Clear chat history for new file

    Ok(result)
}

/// Cancel file analysis
#[tauri::command]
pub async fn cancel_analysis() -> Result<(), String> {
    CANCEL_ANALYSIS.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

/// Send a chat message to Claude
/// Automatically injects audio context before the user message
#[tauri::command]
pub async fn send_message(
    app: AppHandle,
    state: State<'_, AppStateHandle>,
    text: String,
    mode: String,
    ai_mode: String,
    selected_channel: Option<String>,
    available_plugins: Vec<String>,
    mix_style: Option<String>,
    reference_track: Option<String>,
) -> Result<(), String> {
    let (api_provider, openai_url, openai_key, api_key, model, system_with_ctx, api_messages, _monitor_device) = {
        let mut s = state.lock().await;

        let api_provider = s.api_provider.clone();
        let openai_url = s.openai_url.clone();
        let openai_key = s.openai_key.clone();
        let api_key = s.api_key.clone();

        if api_provider == "anthropic" && api_key.is_none() {
            return Err("No API key configured. Add it in Settings.".to_string());
        }

        if s.is_streaming {
            return Err("Already streaming a response".to_string());
        }
        s.is_streaming = true;

        let monitor_device = s.monitor_device.clone();

        // Build context based on mode
        let context_str = match mode.as_str() {
            "daw" => {
                if let Some(cached_channels) = &s.daw_capture_cache {
                    context::build_daw_context(
                        cached_channels,
                        selected_channel.as_deref(),
                        &monitor_device,
                        mix_style.as_deref(),
                        reference_track.as_deref(),
                    )
                } else {
                    "No DAW capture found. Please record a capture first.".to_string()
                }
            },
            "file" => {
                if let (Some(analysis), Some(filename)) = (&s.file_analysis, &s.file_name) {
                    context::build_file_context(analysis, filename, &monitor_device)
                } else {
                    "No file analyzed yet.".to_string()
                }
            }
            _ => String::new(),
        };

        // Inject context as prefix to user message (invisible in UI)
        let user_message_with_ctx = if context_str.is_empty() {
            text.clone()
        } else {
            format!("{}\n\nUser question: {}", context_str, text)
        };

        // Add to history (store clean text for display)
        s.add_message("user", text.clone());
        let _ = app.emit("chat-user-message", serde_json::json!({ "text": &text }));

        let model = s.model.clone();
        let messages = s.messages.clone();

        // Replace last user message with context-injected version for API
        let mut api_messages = messages.clone();
        if let Some(last) = api_messages.last_mut() {
            if last.role == "user" {
                last.content = user_message_with_ctx;
            }
        }

        let mut system = if ai_mode == "agent" {
            prompts::SYSTEM_PROMPT_AGENT.to_string()
        } else {
            prompts::SYSTEM_PROMPT_ASK.to_string()
        };

        if !available_plugins.is_empty() {
            let plugins_str = available_plugins.join(", ");
            system.push_str(&format!("\n\nAVAILABLE PLUGINS ON USER SYSTEM:\n{}\n\nCRITICAL: When recommending a plugin for a specific fix, ONLY recommend a plugin from this available list if possible.", plugins_str));
        }

        (api_provider, openai_url, openai_key, api_key, model, system, api_messages, monitor_device)
    };

    // Stream response from the selected provider
    // NOTE: we pass api_messages (context-injected last user message), not the raw messages
    let response = if api_provider == "openai" {
        openai::stream_chat(
            &app,
            &openai_url,
            openai_key.as_deref(),
            &model,
            &system_with_ctx,
            &api_messages,
        ).await
    } else {
        claude::stream_chat(
            &app,
            &api_key.unwrap_or_default(),
            &model,
            &system_with_ctx,
            &api_messages,
        ).await
    };

    // Update state after streaming completes
    let mut s = state.lock().await;
    s.is_streaming = false;

    match response {
        Ok(text) => {
            s.add_message("assistant", text.clone());
            let _ = app.emit("ai-stream-done", serde_json::json!({ "text": text }));
            Ok(())
        }
        Err(e) => {
            let err_msg = e.to_string();
            let _ = app.emit("ai-error", serde_json::json!({ "error": &err_msg }));
            Err(err_msg)
        }
    }
}

/// Clear chat message history
#[tauri::command]
pub async fn clear_history(
    state: State<'_, AppStateHandle>,
) -> Result<(), String> {
    let mut s = state.lock().await;
    s.clear_messages();
    Ok(())
}

/// Get current config (safe — no API key in response)
#[tauri::command]
pub async fn get_config() -> Result<serde_json::Value, String> {
    let cfg = config::load_config();
    Ok(serde_json::json!({
        "provider": cfg.api.provider,
        "model": cfg.api.model,
        "hasApiKey": !cfg.api.anthropic_key.is_empty(),
        "openaiUrl": cfg.api.openai_url,
        "openaiKey": cfg.api.openai_key,
        "monitorDevice": cfg.monitors.device,
        "language": cfg.ui.language,
    }))
}

/// Save config (API key + preferences)
#[tauri::command]
pub async fn save_config(
    state: State<'_, AppStateHandle>,
    provider: Option<String>,
    api_key: Option<String>,
    openai_url: Option<String>,
    openai_key: Option<String>,
    model: Option<String>,
    monitor_device: Option<String>,
) -> Result<(), String> {
    let mut cfg = config::load_config();

    if let Some(p) = &provider {
        cfg.api.provider = p.clone();
    }
    if let Some(key) = &api_key {
        cfg.api.anthropic_key = key.clone();
    }
    if let Some(url) = &openai_url {
        cfg.api.openai_url = url.clone();
    }
    if let Some(okey) = &openai_key {
        cfg.api.openai_key = okey.clone();
    }
    if let Some(m) = &model {
        cfg.api.model = m.clone();
    }
    if let Some(dev) = &monitor_device {
        cfg.monitors.device = dev.clone();
    }

    config::save_config(&cfg).map_err(|e| e.to_string())?;

    // Update runtime state
    let mut s = state.lock().await;
    if let Some(p) = provider {
        s.api_provider = p;
    }
    if let Some(key) = api_key {
        if !key.is_empty() {
            s.api_key = Some(key);
        }
    }
    if let Some(url) = openai_url {
        s.openai_url = url;
    }
    if let Some(okey) = openai_key {
        s.openai_key = if okey.is_empty() { None } else { Some(okey) };
    }
    if let Some(m) = model {
        s.model = m;
    }
    if let Some(dev) = monitor_device {
        s.monitor_device = dev;
    }

    Ok(())
}

/// Scan for VST/CLAP plugins in standard and custom paths
#[tauri::command]
pub async fn scan_plugins(app: AppHandle, custom_paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut plugins = Vec::new();
    let mut paths_to_scan: Vec<std::path::PathBuf> = vec![
        r"C:\Program Files\Common Files\VST3".into(),
        r"C:\Program Files\Common Files\VST2".into(),
        r"C:\Program Files\VSTPlugins".into(),
        r"C:\Program Files\Steinberg\VstPlugins".into(),
    ];
    
    paths_to_scan.extend(custom_paths.into_iter().map(std::path::PathBuf::from));

    // Iterative depth-first search
    let mut stack = paths_to_scan;
    let mut count = 0;

    while let Some(path) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&path) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(file_type) = entry.file_type() {
                    // Dive into directories
                    if file_type.is_dir() {
                        stack.push(entry.path());
                        continue;
                    }
                    
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".vst3") || name.ends_with(".dll") || name.ends_with(".clap") {
                        if let Some(base) = name.rsplit_once('.') {
                            plugins.push(base.0.to_string());
                        } else {
                            plugins.push(name);
                        }
                        count += 1;
                        // Emit progress periodically to avoid UI lag
                        if count % 5 == 0 {
                            let _ = app.emit("scan-progress", serde_json::json!({
                                "count": count,
                                "path": path.to_string_lossy().to_string()
                            }));
                        }
                    }
                }
            }
        }
    }
    
    plugins.sort();
    plugins.dedup();
    Ok(plugins)
}

/// Start DAW capture for up to 40 seconds
#[tauri::command]
pub async fn start_daw_capture(
    app: AppHandle,
    state: State<'_, AppStateHandle>,
    excluded_channels: Vec<String>,
) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    
    {
        let mut s = state.lock().await;
        s.is_capturing.store(true, Ordering::SeqCst);
        s.daw_capture_cache = None;
    }

    let state_clone = state.inner().clone();
    
    tokio::spawn(async move {
        let mut accumulated_channels: std::collections::HashMap<String, bridge::ChannelSnapshot> = std::collections::HashMap::new();
        let mut frames_count: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        
        let mut playback_frames = 0;
        let max_playback_frames = (40.0 * 20.0) as u32; // 40 seconds at 20Hz
        let interval = std::time::Duration::from_millis(50); // 20Hz polling
        
        loop {
            // Check cancellation or timeout
            {
                let s = state_clone.lock().await;
                if !s.is_capturing.load(Ordering::SeqCst) {
                    break;
                }
            }
            if playback_frames >= max_playback_frames {
                break;
            }

            let current_channels = bridge::get_channels_from_shm().await;
            
            let is_playing = current_channels.iter().any(|c| c.is_playing);
            
            if is_playing {
                playback_frames += 1;
                for mut ch in current_channels {
                // Skip excluded
                if excluded_channels.contains(&ch.instance_id) {
                    continue;
                }
                
                // If it's silent, maybe don't accumulate? 
                // We'll accumulate anyway to capture the full picture
                let id = ch.instance_id.clone();
                let count = frames_count.entry(id.clone()).or_insert(0);
                *count += 1;
                
                if let Some(acc) = accumulated_channels.get_mut(&id) {
                    // Accumulate LUFS (Linear average of power)
                    // We'll do a simple average for LUFS for now, or just keep max.
                    // LUFS is already smoothed by the plugin, but over 40s we want the average.
                    acc.lufs_m += ch.lufs_m;
                    acc.lufs_s += ch.lufs_s;
                    acc.true_peak = acc.true_peak.max(ch.true_peak);
                    acc.peak_l = acc.peak_l.max(ch.peak_l);
                    acc.peak_r = acc.peak_r.max(ch.peak_r);
                    acc.correlation += ch.correlation;
                    acc.crest_factor += ch.crest_factor;
                    
                        for i in 0..31 {
                            acc.fft_bands[i] += ch.fft_bands[i];
                        }
                    } else {
                        accumulated_channels.insert(id, ch);
                    }
                }
            }
            
            tokio::time::sleep(interval).await;
        }
        
        // Finalize averages
        let mut final_channels: Vec<bridge::ChannelSnapshot> = accumulated_channels.into_values().map(|mut acc| {
            if let Some(count) = frames_count.get(&acc.instance_id) {
                let cnt = *count as f32;
                if cnt > 0.0 {
                    acc.lufs_m /= cnt;
                    acc.lufs_s /= cnt;
                    acc.correlation /= cnt;
                    acc.crest_factor /= cnt;
                    for i in 0..31 {
                        acc.fft_bands[i] /= cnt;
                    }
                }
            }
            acc
        }).collect();
        
        // Sort by order
        final_channels.sort_by_key(|c| c.order);
        
        // Save to cache
        {
            let mut s = state_clone.lock().await;
            s.is_capturing.store(false, Ordering::SeqCst);
            s.daw_capture_cache = Some(final_channels);
        }
        
        let _ = app.emit("capture-done", ());
    });

    Ok(())
}

/// Stop DAW capture
#[tauri::command]
pub async fn stop_daw_capture(
    state: State<'_, AppStateHandle>,
) -> Result<(), String> {
    let s = state.lock().await;
    s.is_capturing.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

/// Generate a short title for the chat based on the first message
#[tauri::command]
pub async fn generate_chat_title(
    state: State<'_, AppStateHandle>,
    message: String,
) -> Result<String, String> {
    let (api_key, model) = {
        let s = state.lock().await;
        let key = s.api_key.clone().ok_or_else(|| "No API key".to_string())?;
        (key, s.model.clone())
    };

    let client = reqwest::Client::new();
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("x-api-key", reqwest::header::HeaderValue::from_str(&api_key).unwrap());
    headers.insert("anthropic-version", reqwest::header::HeaderValue::from_static("2023-06-01"));
    headers.insert(reqwest::header::CONTENT_TYPE, reqwest::header::HeaderValue::from_static("application/json"));

    let system = "Generate a very short, concise title (max 4 words) summarizing the user's message. Reply ONLY with the title, no quotes or intro.";
    
    let request_body = serde_json::json!({
        "model": "claude-3-haiku-20240307", // Always use fast model for titles
        "max_tokens": 15,
        "system": system,
        "messages": [
            { "role": "user", "content": message }
        ],
        "stream": false
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .headers(headers)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err("API error".to_string());
    }

    let parsed: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let title = parsed["content"][0]["text"].as_str().unwrap_or("Session").trim().trim_matches('"').to_string();
    
    Ok(title)
}

/// Apply plugin parameters via OSC
#[tauri::command]
pub async fn apply_plugin_parameters(
    state: State<'_, AppStateHandle>,
    instance_id: String,
    parameters: std::collections::HashMap<String, f32>,
) -> Result<(), String> {
    // Step 1: Find channel in LIVE SHM first (most current osc_port)
    let channels = bridge::get_channels_from_shm().await;
    let live_channel = channels.iter().find(|c| c.instance_id == instance_id).cloned();

    // Step 2: Fall back to capture cache if not found in live SHM
    let channel = if let Some(ch) = live_channel {
        ch
    } else {
        let s = state.lock().await;
        if let Some(cache) = &s.daw_capture_cache {
            cache.iter()
                .find(|c| c.instance_id == instance_id)
                .cloned()
                .ok_or_else(|| format!(
                    "Channel {} not found in live SHM or capture cache. \
                     Make sure MixMind MultiFX is loaded and the DAW is playing.",
                    &instance_id[..8]
                ))?
        } else {
            return Err(format!(
                "Channel {} not found. No capture cache available. Try recapturing the mix.",
                &instance_id[..8]
            ));
        }
    };

    if channel.osc_port == 0 {
        return Err(format!(
            "Channel '{}' does not support OSC control (osc_port=0). \
             Make sure MixMind MultiFX plugin is loaded on this track, not just the Bridge plugin.",
            channel.display_name
        ));
    }

    let addr = format!("127.0.0.1:{}", channel.osc_port);

    // Bind local socket (use blocking socket — safe from async context for UDP)
    let socket = std::net::UdpSocket::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;

    let param_count = parameters.len();
    for (param_id, value) in &parameters {
        let osc_addr = format!("/mixmind/multifx/param/{}", param_id);

        let msg = rosc::OscPacket::Message(rosc::OscMessage {
            addr: osc_addr,
            args: vec![rosc::OscType::Float(*value)],
        });

        let buf = rosc::encoder::encode(&msg)
            .map_err(|e| format!("OSC encode error for param '{}': {}", param_id, e))?;

        socket.send_to(&buf, &addr)
            .map_err(|e| format!("UDP send to {} failed: {}", addr, e))?;

        // Small delay between packets to avoid UDP buffer overflow on loopback
        // (especially important when sending many parameters at once)
        if param_count > 5 {
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
    }

    Ok(())
}

/// Trigger a short audio preview capture via OSC
#[tauri::command]
pub async fn trigger_preview(
    state: State<'_, AppStateHandle>,
    instance_id: String,
) -> Result<(), String> {
    // Step 1: Find channel in LIVE SHM first (most current osc_port)
    let channels = bridge::get_channels_from_shm().await;
    let live_channel = channels.iter().find(|c| c.instance_id == instance_id).cloned();

    // Step 2: Fall back to capture cache if not found in live SHM
    let channel = if let Some(ch) = live_channel {
        ch
    } else {
        let s = state.lock().await;
        if let Some(cache) = &s.daw_capture_cache {
            cache.iter()
                .find(|c| c.instance_id == instance_id)
                .cloned()
                .ok_or_else(|| format!("Channel not found"))?
        } else {
            return Err("Channel not found. No capture cache available.".to_string());
        }
    };

    if channel.osc_port == 0 {
        return Err(format!(
            "Channel '{}' does not support OSC control (osc_port=0).",
            channel.display_name
        ));
    }

    let addr = format!("127.0.0.1:{}", channel.osc_port);
    let socket = std::net::UdpSocket::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;

    let msg = rosc::OscPacket::Message(rosc::OscMessage {
        addr: "/mixmind/preview".to_string(),
        args: vec![],
    });

    let buf = rosc::encoder::encode(&msg)
        .map_err(|e| format!("OSC encode error: {}", e))?;

    socket.send_to(&buf, &addr)
        .map_err(|e| format!("UDP send to {} failed: {}", addr, e))?;

    Ok(())
}

/// Get the path to the preview audio file
#[tauri::command]
pub async fn get_preview_path(instance_id: String) -> Result<String, String> {
    let mut temp_dir = std::env::temp_dir();
    temp_dir.push(format!("mixmind_preview_{}.wav", instance_id));
    Ok(temp_dir.to_string_lossy().into_owned())
}

