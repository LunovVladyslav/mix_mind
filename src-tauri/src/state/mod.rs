// MixMind — AppState
// Shared mutable state across all Tauri commands

use crate::ai::claude::Message;
use crate::bridge::ChannelSnapshot;
use crate::audio::analyzer::AnalysisResult;

pub struct AppState {
    /// Current DAW channels from shared memory
    pub channels: Vec<ChannelSnapshot>,

    /// Cached long-term DAW analysis capture
    pub daw_capture_cache: Option<Vec<ChannelSnapshot>>,

    /// Is currently capturing DAW telemetry
    pub is_capturing: std::sync::Arc<std::sync::atomic::AtomicBool>,

    /// Whether the bridge shared memory is connected
    pub bridge_connected: bool,

    /// Conversation history (last 20 messages)
    pub messages: Vec<Message>,

    /// Current file analysis result (File Mode)
    pub file_analysis: Option<AnalysisResult>,

    /// Filename of the currently loaded file
    pub file_name: Option<String>,

    /// Whether an AI response is currently streaming
    pub is_streaming: bool,

    /// API Provider (anthropic or openai)
    pub api_provider: String,

    /// Claude API key (loaded from config or env)
    pub api_key: Option<String>,

    /// OpenAI compatible API URL
    pub openai_url: String,

    /// OpenAI API key (optional)
    pub openai_key: Option<String>,

    /// Claude model name
    pub model: String,

    /// Active monitor device for compensation
    pub monitor_device: String,
}

impl AppState {
    pub fn new() -> Self {
        // Try to load API key from environment first
        let api_key = std::env::var("ANTHROPIC_API_KEY").ok();
        let cfg = crate::config::load_config();

        let api_key = api_key.or_else(|| {
            if !cfg.api.anthropic_key.is_empty() {
                Some(cfg.api.anthropic_key.clone())
            } else {
                None
            }
        });

        let model = std::env::var("MIXMIND_MODEL")
            .unwrap_or_else(|_| cfg.api.model.clone());

        Self {
            channels: Vec::new(),
            daw_capture_cache: None,
            is_capturing: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            bridge_connected: false,
            messages: Vec::new(),
            file_analysis: None,
            file_name: None,
            is_streaming: false,
            api_provider: cfg.api.provider.clone(),
            api_key,
            openai_url: cfg.api.openai_url.clone(),
            openai_key: if cfg.api.openai_key.is_empty() { None } else { Some(cfg.api.openai_key.clone()) },
            model,
            monitor_device: cfg.monitors.device,
        }
    }

    pub fn add_message(&mut self, role: &str, content: String) {
        self.messages.push(Message {
            role: role.to_string(),
            content,
        });
        // Keep only last 20 messages to control context size
        if self.messages.len() > 20 {
            let excess = self.messages.len() - 20;
            self.messages.drain(0..excess);
        }
    }

    pub fn clear_messages(&mut self) {
        self.messages.clear();
    }
}
