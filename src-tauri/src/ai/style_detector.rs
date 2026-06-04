// Genre/Style detection from audio metrics
// No ML — pure heuristics from BPM + FFT spectrum energy

use serde::{Deserialize, Serialize};

/// All supported genres and subgenres
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Genre {
    // Electronic
    House, DeepHouse, TechHouse, Techno, Trance, ProgressiveTrance,
    Dubstep, DrumAndBass, Jungle, Breaks, Ambient, Chillout, Garage,
    // Hip-Hop
    HipHop, Trap, Drill, RnB, NeoSoul, LoFi,
    // Rock/Guitar
    Rock, AlternativeRock, IndieRock, Metal, HeavyMetal, DeathMetal,
    Punk, Grunge, PostRock, ProgressiveRock,
    // Acoustic/Folk
    Folk, AcousticPop, IndiePop, SingerSongwriter, CountryPop,
    // Classical/Cinematic
    Classical, Orchestral, CinematicScore, MinimalClassical,
    // Jazz/Soul
    Jazz, ModernJazz, Blues, Soul, Funk, Gospel,
    // World
    Latin, Reggaeton, Afrobeat, KPop, JPop, Reggae,
    // Fallback
    Unknown,
}

impl Genre {
    /// Return knowledge base genre tag (matches frontmatter genres)
    pub fn to_kb_tag(&self) -> &'static str {
        match self {
            Genre::House | Genre::DeepHouse | Genre::TechHouse => "house",
            Genre::Techno => "techno",
            Genre::Trance | Genre::ProgressiveTrance => "trance",
            Genre::Dubstep => "dubstep",
            Genre::DrumAndBass | Genre::Jungle | Genre::Breaks => "drum_and_bass",
            Genre::Ambient | Genre::Chillout => "ambient",
            Genre::Garage => "house",
            Genre::HipHop | Genre::LoFi => "hip_hop",
            Genre::Trap => "trap",
            Genre::Drill => "drill",
            Genre::RnB | Genre::NeoSoul => "rnb",
            Genre::Rock | Genre::AlternativeRock | Genre::IndieRock => "rock",
            Genre::Metal | Genre::HeavyMetal | Genre::DeathMetal => "metal",
            Genre::Punk | Genre::Grunge => "punk",
            Genre::PostRock | Genre::ProgressiveRock => "rock",
            Genre::Folk | Genre::AcousticPop | Genre::SingerSongwriter => "folk",
            Genre::IndiePop => "indie_pop",
            Genre::CountryPop => "folk",
            Genre::Classical | Genre::MinimalClassical => "classical",
            Genre::Orchestral | Genre::CinematicScore => "cinematic_score",
            Genre::Jazz | Genre::ModernJazz => "jazz",
            Genre::Blues => "blues",
            Genre::Soul | Genre::Funk | Genre::Gospel => "soul",
            Genre::Latin | Genre::Reggaeton => "latin",
            Genre::Afrobeat => "afrobeat",
            Genre::KPop | Genre::JPop => "pop",
            Genre::Reggae => "reggae",
            Genre::Unknown => "all",
        }
    }

    /// Human-readable name
    pub fn display_name(&self) -> &'static str {
        match self {
            Genre::House => "House",
            Genre::DeepHouse => "Deep House",
            Genre::TechHouse => "Tech House",
            Genre::Techno => "Techno",
            Genre::Trance => "Trance",
            Genre::ProgressiveTrance => "Progressive Trance",
            Genre::Dubstep => "Dubstep",
            Genre::DrumAndBass => "Drum & Bass",
            Genre::Jungle => "Jungle",
            Genre::Breaks => "Breaks",
            Genre::Ambient => "Ambient",
            Genre::Chillout => "Chillout",
            Genre::Garage => "Garage",
            Genre::HipHop => "Hip-Hop",
            Genre::Trap => "Trap",
            Genre::Drill => "Drill",
            Genre::RnB => "R&B",
            Genre::NeoSoul => "Neo-Soul",
            Genre::LoFi => "Lo-Fi Hip-Hop",
            Genre::Rock => "Rock",
            Genre::AlternativeRock => "Alternative Rock",
            Genre::IndieRock => "Indie Rock",
            Genre::Metal => "Metal",
            Genre::HeavyMetal => "Heavy Metal",
            Genre::DeathMetal => "Death Metal",
            Genre::Punk => "Punk",
            Genre::Grunge => "Grunge",
            Genre::PostRock => "Post-Rock",
            Genre::ProgressiveRock => "Progressive Rock",
            Genre::Folk => "Folk",
            Genre::AcousticPop => "Acoustic Pop",
            Genre::IndiePop => "Indie Pop",
            Genre::SingerSongwriter => "Singer-Songwriter",
            Genre::CountryPop => "Country / Country Pop",
            Genre::Classical => "Classical",
            Genre::Orchestral => "Orchestral",
            Genre::CinematicScore => "Cinematic / Film Score",
            Genre::MinimalClassical => "Minimal Classical",
            Genre::Jazz => "Jazz",
            Genre::ModernJazz => "Modern Jazz",
            Genre::Blues => "Blues",
            Genre::Soul => "Soul",
            Genre::Funk => "Funk",
            Genre::Gospel => "Gospel",
            Genre::Latin => "Latin",
            Genre::Reggaeton => "Reggaeton",
            Genre::Afrobeat => "Afrobeat",
            Genre::KPop => "K-Pop",
            Genre::JPop => "J-Pop",
            Genre::Reggae => "Reggae",
            Genre::Unknown => "Unknown / Auto-detect",
        }
    }

    /// All genres grouped for UI display
    pub fn all_grouped() -> Vec<(&'static str, Vec<Genre>)> {
        vec![
            ("Electronic", vec![
                Genre::House, Genre::DeepHouse, Genre::TechHouse,
                Genre::Techno, Genre::Trance, Genre::ProgressiveTrance,
                Genre::Dubstep, Genre::DrumAndBass, Genre::Jungle,
                Genre::Breaks, Genre::Ambient, Genre::Chillout, Genre::Garage,
            ]),
            ("Hip-Hop / Urban", vec![
                Genre::HipHop, Genre::Trap, Genre::Drill,
                Genre::RnB, Genre::NeoSoul, Genre::LoFi,
            ]),
            ("Rock / Metal", vec![
                Genre::Rock, Genre::AlternativeRock, Genre::IndieRock,
                Genre::Metal, Genre::HeavyMetal, Genre::DeathMetal,
                Genre::Punk, Genre::Grunge, Genre::PostRock, Genre::ProgressiveRock,
            ]),
            ("Acoustic / Folk", vec![
                Genre::Folk, Genre::AcousticPop, Genre::IndiePop,
                Genre::SingerSongwriter, Genre::CountryPop,
            ]),
            ("Classical / Cinematic", vec![
                Genre::Classical, Genre::Orchestral,
                Genre::CinematicScore, Genre::MinimalClassical,
            ]),
            ("Jazz / Soul", vec![
                Genre::Jazz, Genre::ModernJazz, Genre::Blues,
                Genre::Soul, Genre::Funk, Genre::Gospel,
            ]),
            ("World", vec![
                Genre::Latin, Genre::Reggaeton, Genre::Afrobeat,
                Genre::KPop, Genre::JPop, Genre::Reggae,
            ]),
        ]
    }
}

/// Detected style with confidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedStyle {
    pub genre: Genre,
    pub confidence: f32,      // 0.0 - 1.0
    pub bpm_class: BpmClass,
    pub energy_class: EnergyClass,
    pub user_override: Option<Genre>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BpmClass {
    VerySlow,   // < 70
    Slow,       // 70-90
    MidTempo,   // 90-120
    Fast,       // 120-145
    VeryFast,   // > 145
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnergyClass {
    Ambient,    // very low energy
    Low,
    Medium,
    High,
    VeryHigh,   // club/EDM level
}

impl DetectedStyle {
    /// The effective genre (user override takes priority)
    pub fn effective_genre(&self) -> &Genre {
        self.user_override.as_ref().unwrap_or(&self.genre)
    }

    pub fn effective_genre_tag(&self) -> &'static str {
        self.effective_genre().to_kb_tag()
    }
}

/// Detect style from available audio metrics
/// fft_bands: 31-band FFT array (20Hz - 20kHz in 1/3 octave)
pub fn detect_style(bpm: f32, fft_bands: &[f32]) -> DetectedStyle {
    let bpm_class = classify_bpm(bpm);
    let (sub_energy, low_energy, mid_energy, high_energy) = spectral_energy(fft_bands);
    let energy_class = classify_energy(sub_energy, low_energy, mid_energy, high_energy);

    let (genre, confidence) = infer_genre(
        bpm, &bpm_class, sub_energy, low_energy, mid_energy, high_energy
    );

    DetectedStyle {
        genre,
        confidence,
        bpm_class,
        energy_class,
        user_override: None,
    }
}

fn classify_bpm(bpm: f32) -> BpmClass {
    match bpm as u32 {
        0..=69   => BpmClass::VerySlow,
        70..=89  => BpmClass::Slow,
        90..=119 => BpmClass::MidTempo,
        120..=145 => BpmClass::Fast,
        _        => BpmClass::VeryFast,
    }
}

/// Returns (sub, low, mid, high) energy levels from FFT bands
/// Bands 0-3: sub (20-80 Hz), 4-8: low (80-250Hz),
/// 9-17: mid (250-1600Hz), 18-30: high (1600-20kHz)
fn spectral_energy(bands: &[f32]) -> (f32, f32, f32, f32) {
    if bands.is_empty() { return (0.0, 0.0, 0.0, 0.0); }

    let safe_bands = |range: std::ops::Range<usize>| -> f32 {
        let count = range.end.min(bands.len()).saturating_sub(range.start);
        if count == 0 { return -100.0; }
        bands[range.start..range.end.min(bands.len())]
            .iter()
            .copied()
            .fold(f32::NEG_INFINITY, f32::max)
    };

    let sub  = safe_bands(0..4);   // 20-80 Hz
    let low  = safe_bands(4..9);   // 80-250 Hz
    let mid  = safe_bands(9..18);  // 250-1600 Hz
    let high = safe_bands(18..31); // 1600-20kHz

    (sub, low, mid, high)
}

fn classify_energy(sub: f32, low: f32, mid: f32, high: f32) -> EnergyClass {
    let peak = [sub, low, mid, high].iter().copied().fold(f32::NEG_INFINITY, f32::max);
    match peak as i32 {
        i32::MIN..=-40 => EnergyClass::Ambient,
        -39..=-28      => EnergyClass::Low,
        -27..=-18      => EnergyClass::Medium,
        -17..=-10      => EnergyClass::High,
        _              => EnergyClass::VeryHigh,
    }
}

/// Core genre inference heuristic
fn infer_genre(
    bpm: f32,
    bpm_class: &BpmClass,
    sub: f32, _low: f32, mid: f32, _high: f32
) -> (Genre, f32) {
    let heavy_sub = sub > -20.0;
    let heavy_mid = mid > -18.0;

    match bpm_class {
        BpmClass::VeryFast => {
            if bpm > 160.0 && heavy_sub { return (Genre::DrumAndBass, 0.65); }
            if heavy_mid { return (Genre::Metal, 0.60); }
            (Genre::DrumAndBass, 0.50)
        }
        BpmClass::Fast => {
            if bpm >= 130.0 && bpm <= 145.0 && heavy_sub { return (Genre::Techno, 0.65); }
            if bpm >= 120.0 && bpm <= 132.0 && heavy_sub { return (Genre::House, 0.70); }
            if heavy_mid && !heavy_sub { return (Genre::Rock, 0.55); }
            (Genre::House, 0.45)
        }
        BpmClass::MidTempo => {
            if heavy_mid && !heavy_sub { return (Genre::Rock, 0.60); }
            if heavy_sub && !heavy_mid { return (Genre::HipHop, 0.60); }
            (Genre::Rock, 0.40)
        }
        BpmClass::Slow => {
            if heavy_sub && sub > -15.0 { return (Genre::Trap, 0.70); }
            if heavy_sub { return (Genre::HipHop, 0.65); }
            if heavy_mid { return (Genre::Folk, 0.50); }
            (Genre::RnB, 0.45)
        }
        BpmClass::VerySlow => {
            if !heavy_sub && !heavy_mid { return (Genre::Ambient, 0.65); }
            (Genre::Classical, 0.50)
        }
    }
}

/// Convert user-selected genre string (from frontend) to Genre enum
pub fn genre_from_str(s: &str) -> Option<Genre> {
    let lower = s.to_lowercase().replace([' ', '-', '&'], "_");
    match lower.as_str() {
        "house" => Some(Genre::House),
        "deep_house" => Some(Genre::DeepHouse),
        "tech_house" => Some(Genre::TechHouse),
        "techno" => Some(Genre::Techno),
        "trance" => Some(Genre::Trance),
        "progressive_trance" => Some(Genre::ProgressiveTrance),
        "dubstep" => Some(Genre::Dubstep),
        "drum__bass" | "d_b" | "drum_and_bass" => Some(Genre::DrumAndBass),
        "jungle" => Some(Genre::Jungle),
        "breaks" => Some(Genre::Breaks),
        "ambient" => Some(Genre::Ambient),
        "chillout" | "chill" => Some(Genre::Chillout),
        "garage" => Some(Genre::Garage),
        "hip_hop" | "hiphop" | "hip-hop" => Some(Genre::HipHop),
        "trap" => Some(Genre::Trap),
        "drill" => Some(Genre::Drill),
        "r_b" | "rnb" | "r&b" => Some(Genre::RnB),
        "neo_soul" | "neosoul" => Some(Genre::NeoSoul),
        "lo_fi" | "lofi" | "lo-fi" => Some(Genre::LoFi),
        "rock" => Some(Genre::Rock),
        "alternative_rock" | "alt_rock" | "alt._rock" => Some(Genre::AlternativeRock),
        "indie_rock" => Some(Genre::IndieRock),
        "metal" => Some(Genre::Metal),
        "heavy_metal" => Some(Genre::HeavyMetal),
        "death_metal" => Some(Genre::DeathMetal),
        "punk" => Some(Genre::Punk),
        "grunge" => Some(Genre::Grunge),
        "post_rock" | "post-rock" => Some(Genre::PostRock),
        "progressive_rock" | "prog_rock" => Some(Genre::ProgressiveRock),
        "folk" => Some(Genre::Folk),
        "acoustic_pop" | "acoustic" => Some(Genre::AcousticPop),
        "indie_pop" | "indie" => Some(Genre::IndiePop),
        "singer_songwriter" | "singer-songwriter" => Some(Genre::SingerSongwriter),
        "country" | "country_pop" => Some(Genre::CountryPop),
        "classical" => Some(Genre::Classical),
        "orchestral" => Some(Genre::Orchestral),
        "cinematic" | "cinematic_score" | "film_score" => Some(Genre::CinematicScore),
        "minimal_classical" => Some(Genre::MinimalClassical),
        "jazz" => Some(Genre::Jazz),
        "modern_jazz" => Some(Genre::ModernJazz),
        "blues" => Some(Genre::Blues),
        "soul" => Some(Genre::Soul),
        "funk" => Some(Genre::Funk),
        "gospel" => Some(Genre::Gospel),
        "latin" => Some(Genre::Latin),
        "reggaeton" => Some(Genre::Reggaeton),
        "afrobeat" | "afropop" => Some(Genre::Afrobeat),
        "k_pop" | "kpop" | "k-pop" => Some(Genre::KPop),
        "j_pop" | "jpop" | "j-pop" => Some(Genre::JPop),
        "reggae" => Some(Genre::Reggae),
        _ => None,
    }
}

