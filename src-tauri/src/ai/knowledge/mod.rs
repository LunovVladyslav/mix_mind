// MixMind Knowledge Base — Structured RAG Engine
// Loads .md files from assets/knowledge/, tags-based retrieval, no vector embeddings needed.

use serde::Deserialize;
use std::sync::OnceLock;

/// One knowledge chunk = one .md file (or section)
#[derive(Debug, Clone)]
pub struct KnowledgeChunk {
    pub id: String,
    pub content: String,
    pub tags: Vec<String>,
    pub channel_types: Vec<String>,
    pub genres: Vec<String>,
    pub priority: u8,
}

/// Context for retrieval — built from the current channel + style state
#[derive(Debug, Clone, Default)]
pub struct RetrievalContext {
    /// e.g. "instrument", "drum_bus", "bus", "send", "master"
    pub channel_type: String,
    /// e.g. "rock", "house", "trap"
    pub genre: String,
    /// e.g. "guitars", "drums", "vocals" — inferred from display_name
    pub instrument_hint: String,
    /// Detected issues: "mud", "peak_clipping", "sibilance", "thin", "dull"
    pub detected_issues: Vec<String>,
    /// Max characters total for the knowledge section in the prompt
    pub token_budget: usize,
}

impl RetrievalContext {
    pub fn new(channel_type: &str, genre: &str) -> Self {
        Self {
            channel_type: channel_type.to_string(),
            genre: genre.to_string(),
            token_budget: 6000,
            ..Default::default()
        }
    }

    /// Infer instrument type from display name
    pub fn with_display_name(mut self, name: &str) -> Self {
        let lower = name.to_lowercase();
        self.instrument_hint = if lower.contains("drum") || lower.contains("kick") || lower.contains("snare") {
            "drums".into()
        } else if lower.contains("bass") || lower.contains("808") || lower.contains("sub") {
            "bass".into()
        } else if lower.contains("guitar") || lower.contains("gtr") {
            "guitars".into()
        } else if lower.contains("vocal") || lower.contains("vox") || lower.contains("voice") {
            "vocals".into()
        } else if lower.contains("key") || lower.contains("piano") || lower.contains("synth") || lower.contains("pad") {
            "keys".into()
        } else if lower.contains("master") || lower.contains("mix") || lower.contains("2bus") || lower.contains("2 bus") {
            "master".into()
        } else {
            String::new()
        };
        self
    }

    /// Add detected issues from channel metrics
    pub fn with_metrics(mut self, lufs: f32, true_peak: f32, crest_factor: f32, correlation: f32) -> Self {
        if true_peak > -1.0 {
            self.detected_issues.push("peak_clipping".into());
        }
        if crest_factor > 20.0 {
            self.detected_issues.push("high_dynamics".into());
        }
        if correlation < 0.4 {
            self.detected_issues.push("phase_issues".into());
        }
        if lufs > -6.0 {
            self.detected_issues.push("too_loud".into());
        }
        self
    }
}

/// The knowledge base — loaded once at startup
pub struct KnowledgeBase {
    chunks: Vec<KnowledgeChunk>,
}

static KB: OnceLock<KnowledgeBase> = OnceLock::new();

/// YAML frontmatter structure for each .md file
#[derive(Debug, Deserialize, Default)]
struct Frontmatter {
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    channel_types: Vec<String>,
    #[serde(default)]
    genres: Vec<String>,
    #[serde(default = "default_priority")]
    priority: u8,
}

fn default_priority() -> u8 { 5 }

impl KnowledgeBase {
    /// Load all .md files from the knowledge directory
    pub fn load() -> Self {
        let mut chunks = Vec::new();

        // Try multiple paths — covers dev (cargo run) and Tauri production
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()));

        let mut base_paths = vec![
            // Dev mode: running from src-tauri directory
            std::path::PathBuf::from("assets/knowledge"),
            // Dev mode: running from workspace root
            std::path::PathBuf::from("src-tauri/assets/knowledge"),
        ];

        // Production: next to the executable
        if let Some(ref exe) = exe_dir {
            base_paths.push(exe.join("assets/knowledge"));
            base_paths.push(exe.join("../assets/knowledge")); // macOS .app bundle
        }

        for base in &base_paths {
            if base.is_dir() {
                load_dir(base, &mut chunks);
                if !chunks.is_empty() {
                    log::info!("[Knowledge] Loaded {} chunks from {:?}", chunks.len(), base);
                    break;
                }
            }
        }

        // Fallback: use embedded chunks if no files found
        if chunks.is_empty() {
            log::warn!("[Knowledge] No .md files found in any of {:?}, using embedded fallback", base_paths);
            chunks.extend(embedded_fallback());
        }

        KnowledgeBase { chunks }
    }

    /// Get the global singleton, loading if needed
    pub fn global() -> &'static KnowledgeBase {
        KB.get_or_init(|| KnowledgeBase::load())
    }

    /// Retrieve top-N most relevant chunks for the given context
    pub fn retrieve(&self, ctx: &RetrievalContext) -> Vec<&KnowledgeChunk> {
        let mut scored: Vec<(f32, &KnowledgeChunk)> = self.chunks
            .iter()
            .map(|chunk| (score_chunk(chunk, ctx), chunk))
            .collect();

        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        let mut result = Vec::new();
        let mut total_chars = 0usize;
        let budget = if ctx.token_budget > 0 { ctx.token_budget } else { 6000 };

        for (score, chunk) in &scored {
            if *score <= 0.0 { break; }
            if total_chars + chunk.content.len() > budget { continue; }
            total_chars += chunk.content.len();
            result.push(*chunk);
            if result.len() >= 8 { break; }
        }

        result
    }

    /// Build the knowledge section string for the prompt
    pub fn build_prompt_section(&self, ctx: &RetrievalContext) -> String {
        let chunks = self.retrieve(ctx);
        if chunks.is_empty() {
            return String::new();
        }

        let mut out = String::from("\n## MIXING KNOWLEDGE (relevant to this context)\n\n");
        for chunk in chunks {
            let content = strip_frontmatter(&chunk.content);
            out.push_str(content.trim());
            out.push_str("\n\n---\n\n");
        }
        out
    }
}

/// Score a chunk by its relevance to the retrieval context
fn score_chunk(chunk: &KnowledgeChunk, ctx: &RetrievalContext) -> f32 {
    let mut score = chunk.priority as f32;

    // Channel type match (strongest signal)
    if chunk.channel_types.contains(&"all".to_string()) {
        score += 1.5;
    } else if !ctx.channel_type.is_empty() && chunk.channel_types.iter().any(|t| t == &ctx.channel_type) {
        score += 4.0;
    }

    // Genre match
    if chunk.genres.contains(&"all".to_string()) {
        score += 1.0;
    } else if !ctx.genre.is_empty() && chunk.genres.iter().any(|g| g == &ctx.genre) {
        score += 3.0;
    }

    // Instrument hint match via tags
    if !ctx.instrument_hint.is_empty() && chunk.tags.iter().any(|t| t == &ctx.instrument_hint) {
        score += 3.0;
    }

    // Detected issue match via tags
    for issue in &ctx.detected_issues {
        if chunk.tags.iter().any(|t| t == issue) {
            score += 2.0;
        }
    }

    // FX chain logic is always relevant
    if chunk.tags.contains(&"fx_chain".to_string()) {
        score += 2.0;
    }

    // LUFS/balance always relevant
    if chunk.tags.contains(&"lufs".to_string()) || chunk.tags.contains(&"balance".to_string()) {
        score += 1.5;
    }

    score
}



/// Load all .md files recursively from a directory
fn load_dir(dir: &std::path::Path, chunks: &mut Vec<KnowledgeChunk>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                load_dir(&path, chunks);
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let id = path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let fm = parse_frontmatter(&content);
                    chunks.push(KnowledgeChunk {
                        id,
                        content,
                        tags: fm.tags,
                        channel_types: fm.channel_types,
                        genres: fm.genres,
                        priority: fm.priority,
                    });
                }
            }
        }
    }
}

/// Parse YAML frontmatter between --- delimiters
fn parse_frontmatter(content: &str) -> Frontmatter {
    if !content.starts_with("---") {
        return Frontmatter::default();
    }
    let after = &content[3..];
    if let Some(end) = after.find("\n---") {
        let yaml = &after[..end];
        serde_yaml::from_str(yaml).unwrap_or_default()
    } else {
        Frontmatter::default()
    }
}

/// Strip frontmatter from content for display
fn strip_frontmatter(content: &str) -> &str {
    if !content.starts_with("---") {
        return content;
    }
    let after = &content[3..];
    if let Some(end) = after.find("\n---") {
        let remaining = &after[end + 4..];
        if remaining.starts_with('\n') { &remaining[1..] } else { remaining }
    } else {
        content
    }
}

/// Minimal embedded fallback (used if asset files not found at runtime)
fn embedded_fallback() -> Vec<KnowledgeChunk> {
    vec![
        KnowledgeChunk {
            id: "fx_chain_fallback".into(),
            content: "# FX Chain Order\n\
                EQ(1) → Comp(2) → Exciter(3) → Limiter(4) is the standard order.\n\
                Put EQ first to fix tonal problems before compression.\n\
                Always add Limiter in slot4 when truePeak > -1 dBTP.\n\
                Use FET comp for drums, Opto for vocals, Bus for mix buses.\n\
                Use Tube exciter for vocals/guitars, Transistor for drums.".into(),
            tags: vec!["fx_chain".into(), "slot_order".into()],
            channel_types: vec!["all".into()],
            genres: vec!["all".into()],
            priority: 10,
        },
    ]
}
