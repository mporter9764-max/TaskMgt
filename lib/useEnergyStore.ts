"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fetchAll } from "./db";
import { reportError } from "./toast";
import { DEFAULT_SETTINGS, type EnergyLog, type EnergySettings } from "./energy";

const SETTINGS_KEY = "energy";

export interface EnergyStore {
  loading: boolean;
  error: string | null;
  logs: Map<string, EnergyLog>;
  settings: EnergySettings;
  reload: () => Promise<void>;
  saveLog: (date: string, patch: Partial<Pick<EnergyLog, "steps" | "lifted">>) => Promise<void>;
  clearLog: (date: string) => Promise<void>;
  saveSettings: (s: EnergySettings) => Promise<void>;
}

export function useEnergyStore(enabled: boolean): EnergyStore {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Map<string, EnergyLog>>(new Map());
  const [settings, setSettings] = useState<EnergySettings>(DEFAULT_SETTINGS);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const reload = useCallback(async () => {
    try {
      const [rows, sres] = await Promise.all([
        fetchAll<EnergyLog>("energy_logs", "log_date"),
        supabase.from("app_settings").select("*").eq("key", SETTINGS_KEY).maybeSingle(),
      ]);
      if (sres.error) throw new Error(`app_settings: ${sres.error.message}`);
      setLogs(new Map(rows.map((r) => [r.log_date, r])));
      if (sres.data?.value) setSettings({ ...DEFAULT_SETTINGS, ...(sres.data.value as Partial<EnergySettings>) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const saveLog = useCallback(async (date: string, patch: Partial<Pick<EnergyLog, "steps" | "lifted">>) => {
    const prev = logsRef.current.get(date) ?? { log_date: date, steps: 0, lifted: false };
    const next: EnergyLog = { ...prev, ...patch, log_date: date };
    setLogs((m) => new Map(m).set(date, next));
    const { error } = await supabase
      .from("energy_logs")
      .upsert({ log_date: date, steps: next.steps, lifted: next.lifted, updated_at: new Date().toISOString() }, { onConflict: "log_date" });
    reportError(error, "save the day");
  }, []);

  const clearLog = useCallback(async (date: string) => {
    setLogs((m) => {
      const n = new Map(m);
      n.delete(date);
      return n;
    });
    const { error } = await supabase.from("energy_logs").delete().eq("log_date", date);
    reportError(error, "clear the day");
  }, []);

  const saveSettings = useCallback(async (s: EnergySettings) => {
    setSettings(s);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: SETTINGS_KEY, value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
    reportError(error, "save settings");
  }, []);

  return { loading, error, logs, settings, reload, saveLog, clearLog, saveSettings };
}
