// MixMind — Config Manager
// Loads and saves ~/.config/mixmind/config.toml

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub provider: String,
    pub anthropic_key: String,
    pub openai_url: String,
    pub openai_key: String,
    pub model: String,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            provider: "anthropic".to_string(),
            anthropic_key: String::new(),
            openai_url: "http://localhost:11434/v1".to_string(),
            openai_key: String::new(),
            model: "claude-haiku-4-5".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorsConfig {
    pub device: String,
}

impl Default for MonitorsConfig {
    fn default() -> Self {
        Self {
            device: "custom".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub language: String,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            language: "auto".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub api: ApiConfig,
    #[serde(default)]
    pub monitors: MonitorsConfig,
    #[serde(default)]
    pub ui: UiConfig,
}

fn config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mixmind")
        .join("config.toml")
}

pub fn load_config() -> Config {
    let path = config_path();

    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(contents) => {
                match toml::from_str::<Config>(&contents) {
                    Ok(cfg) => return cfg,
                    Err(e) => log::warn!("Failed to parse config: {e}"),
                }
            }
            Err(e) => log::warn!("Failed to read config: {e}"),
        }
    }

    // Create default config on first run
    let default_cfg = Config::default();
    if let Err(e) = save_config_to_path(&default_cfg, &path) {
        log::warn!("Failed to write default config: {e}");
    }
    default_cfg
}

pub fn save_config(config: &Config) -> Result<()> {
    save_config_to_path(config, &config_path())
}

fn save_config_to_path(config: &Config, path: &PathBuf) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let toml_str = toml::to_string_pretty(config)?;
    std::fs::write(path, toml_str)?;
    Ok(())
}
