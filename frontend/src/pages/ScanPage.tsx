import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import type { ScanMode } from "../lib/supabase";

const MODE_STORAGE_KEY = "cmude_scan_mode";

function loadStoredMode(): ScanMode {
  return localStorage.getItem(MODE_STORAGE_KEY) === "kit" ? "kit" : "lunch";
}

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [mode, setMode] = useState<ScanMode>(loadStoredMode);
  const modeRef = useRef(mode);

  function selectMode(next: ScanMode) {
    setMode(next);
    modeRef.current = next;
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(null, videoRef.current!, (result, err) => {
        if (stopped) return;
        if (result) {
          stopped = true;
          setScanning(false);
          const text = result.getText();
          // Support bare UUID or full URL ending in /p/:uuid
          const uuid = text.includes("/p/") ? text.split("/p/")[1] : text;
          navigate(`/p/${uuid}?mode=${modeRef.current}`);
        } else if (err && !(err instanceof NotFoundException)) {
          setError("Error de cámara: " + err.message);
        }
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      stopped = true;
      reader.reset();
    };
  }, [navigate]);

  return (
    <div className="relative h-dvh w-full bg-black flex flex-col items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* Mode toggle */}
      <div className="absolute top-4 left-4 z-20 flex bg-white/20 backdrop-blur rounded-lg overflow-hidden">
        <button
          onClick={() => selectMode("kit")}
          className={`px-4 py-2 text-sm font-semibold ${mode === "kit" ? "bg-white text-gray-900" : "text-white"}`}
        >
          Kit
        </button>
        <button
          onClick={() => selectMode("lunch")}
          className={`px-4 py-2 text-sm font-semibold ${mode === "lunch" ? "bg-white text-gray-900" : "text-white"}`}
        >
          Almuerzo
        </button>
      </div>

      {/* Scanning overlay */}
      {scanning && (
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-64 h-64 border-4 border-white/80 rounded-2xl shadow-lg" />
          <p className="text-white text-lg font-medium drop-shadow">
            Apunta al código QR — Modo: {mode === "kit" ? "Kit" : "Almuerzo"}
          </p>
        </div>
      )}

      {error && (
        <div className="absolute bottom-8 left-4 right-4 bg-red-600 text-white rounded-xl p-4 text-center z-20">
          {error}
        </div>
      )}

      <a
        href="/admin/login"
        className="absolute top-4 right-4 z-20 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1.5 rounded-lg backdrop-blur"
      >
        Admin
      </a>
    </div>
  );
}
