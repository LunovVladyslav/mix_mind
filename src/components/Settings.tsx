// MixMind — Settings Panel Modal

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore, MonitorDevice } from "../store/appStore";

const MODEL_OPTIONS = [
  { value: "claude-haiku-4-5",  label: "Claude Haiku 4.5 (fast, dev)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-opus-4-5",   label: "Claude Opus 4.5 (powerful)" },
];

const CLAUDE_MODEL_IDS = MODEL_OPTIONS.map(o => o.value);
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

export default function Settings() {
  const {
    setShowSettings, model, setModel,
    setHasApiKey,
    customPluginPaths, setCustomPluginPaths,
    setAvailablePlugins,
    uiScale, setUiScale,
    apiProvider, setApiProvider,
    openaiUrl, setOpenaiUrl,
    openaiKey, setOpenaiKey,
  } = useAppStore();

  const [apiKey, setApiKey]     = useState("");
  const [savedProvider, setSavedProvider] = useState(apiProvider);
  const [savedOpenaiUrl, setSavedOpenaiUrl] = useState(openaiUrl);
  const [savedOpenaiKey, setSavedOpenaiKey] = useState("");
  // If stored model is a local LLM name but provider is anthropic, reset to default Claude model
  const initialModel = apiProvider === "anthropic" && !CLAUDE_MODEL_IDS.includes(model)
    ? DEFAULT_CLAUDE_MODEL
    : model;
  const [savedModel, setSavedModel] = useState(initialModel);
  const [savedScale, setSavedScale] = useState(uiScale);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<any>("scan-progress", (e) => {
      setScanStatus(`Scanned ${e.payload.count} plugins... (${e.payload.path})`);
    }).then(un => unlisten = un);
    return () => { if (unlisten) unlisten(); };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await invoke("save_config", {
        provider: savedProvider,
        apiKey: apiKey || null,
        openaiUrl: savedOpenaiUrl,
        openaiKey: savedOpenaiKey || null,
        model:  savedModel,
        monitorDevice: "custom", // default
      });
      if (apiKey) setHasApiKey(true);
      setApiProvider(savedProvider);
      setOpenaiUrl(savedOpenaiUrl);
      if (savedOpenaiKey) setOpenaiKey(savedOpenaiKey);
      setModel(savedModel);
      setUiScale(savedScale);
      
      // Rescan plugins using updated paths
      try {
        setScanStatus("Starting scan...");
        const plugins = await invoke<string[]>("scan_plugins", { customPaths: customPluginPaths });
        setAvailablePlugins(plugins);
      } catch (scanErr) {
        console.error("Failed to scan plugins:", scanErr);
      } finally {
        setScanStatus(null);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setApiKey("");
      setSavedOpenaiKey("");
    } catch (e) {
      console.error("save_config failed:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
    >
      <div className="bg-surface border border-border rounded-xl w-96 p-6 animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-text">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-text hover:bg-card"
          >
            ✕
          </button>
        </div>

        {/* AI Provider */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-text mb-1.5">
            AI Provider
          </label>
          <select
            value={savedProvider}
            onChange={(e) => {
            const newProvider = e.target.value;
            setSavedProvider(newProvider);
            // Auto-reset model when switching to Anthropic if current is a local LLM model
            if (newProvider === "anthropic" && !CLAUDE_MODEL_IDS.includes(savedModel)) {
              setSavedModel(DEFAULT_CLAUDE_MODEL);
            }
          }}
            className="w-full"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">Local / Custom (OpenAI Compatible)</option>
          </select>
        </div>

        {savedProvider === "anthropic" ? (
          <>
            {/* API Key */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text mb-1.5">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full"
              />
              <p className="text-[10px] text-muted mt-1">
                Leave empty to keep existing key.
                Get yours at{" "}
                <span className="text-accent">console.anthropic.com</span>
              </p>
            </div>

            {/* Model selector */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text mb-1.5">
                Claude Model
              </label>
              <select
                value={savedModel}
                onChange={(e) => setSavedModel(e.target.value)}
                className="w-full"
              >
                {MODEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* Local LLM URL */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text mb-1.5">
                Endpoint URL
              </label>
              <input
                type="text"
                value={savedOpenaiUrl}
                onChange={(e) => setSavedOpenaiUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full"
              />
              <p className="text-[10px] text-muted mt-1">
                Ollama: http://localhost:11434/v1 <br/>
                LM Studio: http://localhost:1234/v1
              </p>
            </div>
            
            {/* Local LLM Model */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text mb-1.5">
                Model Name
              </label>
              <input
                type="text"
                value={savedModel}
                onChange={(e) => setSavedModel(e.target.value)}
                placeholder="llama3"
                className="w-full"
              />
              <p className="text-[10px] text-muted mt-1">
                Enter the exact model name/tag loaded in your local server.
              </p>
            </div>
            
            {/* Local LLM Key */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-text mb-1.5">
                API Key (Optional)
              </label>
              <input
                type="password"
                value={savedOpenaiKey}
                onChange={(e) => setSavedOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full"
              />
            </div>
          </>
        )}



        {/* Plugin Folders */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">
              Custom VST/Plugin Folders
            </label>
            <button
              onClick={async () => {
                const selected = await open({ directory: true, multiple: false });
                if (selected && typeof selected === "string" && !customPluginPaths.includes(selected)) {
                  setCustomPluginPaths([...customPluginPaths, selected]);
                }
              }}
              className="text-[10px] bg-card hover:bg-border/60 text-text px-2 py-1 rounded"
            >
              + Add
            </button>
          </div>
          {customPluginPaths.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto mb-2">
              {customPluginPaths.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-card px-2 py-1.5 rounded text-[10px]">
                  <span className="truncate text-muted font-mono">{p}</span>
                  <button
                    onClick={() => setCustomPluginPaths(customPluginPaths.filter((_, idx) => idx !== i))}
                    className="text-danger hover:text-red-400 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted/60 mb-2 italic">
              Standard folders (C:\Program Files\Common Files\VST3, etc) are scanned automatically.
            </div>
          )}
        </div>

        {/* UI Scale */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-text mb-1.5">
            UI Scale (Zoom)
          </label>
          <select
            value={savedScale}
            onChange={(e) => setSavedScale(parseFloat(e.target.value))}
            className="w-full"
          >
            <option value={0.8}>80% - Small</option>
            <option value={0.9}>90%</option>
            <option value={1.0}>100% - Default</option>
            <option value={1.1}>110%</option>
            <option value={1.25}>125% - Large</option>
            <option value={1.5}>150% - Extra Large</option>
          </select>
        </div>

        {/* Save button and status */}
        <div className="flex flex-col gap-2">
          {scanStatus && (
            <div className="text-[10px] text-accent animate-pulse font-mono truncate">
              {scanStatus}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? "bg-accent/30 text-accent"
                : "bg-accent text-white hover:bg-accent/80"
            }`}
          >
            {saving ? "Saving & Scanning..." : saved ? "✓ Saved!" : "Save & Rescan"}
          </button>
        </div>
      </div>
    </div>
  );
}
