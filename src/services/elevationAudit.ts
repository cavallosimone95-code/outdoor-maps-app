import { getTracks, saveTracks, SavedTrack, updateTrackElevations } from './trackStorage';
import { calculateTrackStats, ElevationTuningOverrides, ElevationSource } from './elevationService';

export interface ElevationAuditOptions {
  maxTracks?: number;              // Limit number of tracks to audit
  forceRecalculate?: boolean;      // Always recalc even if elevationGain present
  minDiffMeters?: number;          // Minimum absolute diff to report/update
  minDiffPercent?: number;         // Minimum percent diff to report/update
  updateStorage?: boolean;         // Persist corrected values
  batchDelayMs?: number;           // Delay between API batches (to respect external API)
  tuningOverrides?: ElevationTuningOverrides; // Optional: test alternative tuning
}

export interface ElevationAuditResultRow {
  id: string;
  name: string;
  points: number;
  oldGain?: number;
  oldLoss?: number;
  newGain: number;
  newLoss: number;
  diffGain: number;
  diffLoss: number;
  diffGainPct?: number;
  diffLossPct?: number;
  updated: boolean;
  skippedReason?: string;
}

export interface ElevationAuditSummary {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  rows: ElevationAuditResultRow[];
}

// Dispatch helper
const emit = (type: string, detail: any) => {
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
};

export async function auditTrackElevations(options: ElevationAuditOptions = {}): Promise<ElevationAuditSummary> {
  const {
    maxTracks,
    forceRecalculate = false,
    minDiffMeters = 10,
    minDiffPercent = 5,
    updateStorage = false,
    batchDelayMs = 600,
    tuningOverrides
  } = options;

  const tracks = getTracks();
  const target = typeof maxTracks === 'number' ? tracks.slice(0, maxTracks) : tracks;

  const rows: ElevationAuditResultRow[] = [];
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < target.length; i++) {
    const t = target[i];
    const label = `[ElevationAudit] (${i + 1}/${target.length}) ${t.name}`;

    if (!t.points || t.points.length < 2) {
      rows.push({
        id: t.id,
        name: t.name,
        points: t.points?.length || 0,
        newGain: 0,
        newLoss: 0,
        diffGain: 0,
        diffLoss: 0,
        updated: false,
        skippedReason: 'Pochi punti'
      });
      skippedCount++;
      continue;
    }

    // Heuristic: skip if already has gain/loss and not forcing
    if (!forceRecalculate && typeof t.elevationGain === 'number' && typeof t.elevationLoss === 'number') {
      rows.push({
        id: t.id,
        name: t.name,
        points: t.points.length,
        oldGain: t.elevationGain,
        oldLoss: t.elevationLoss,
        newGain: t.elevationGain,
        newLoss: t.elevationLoss,
        diffGain: 0,
        diffLoss: 0,
        updated: false,
        skippedReason: 'Gia calcolato'
      });
      skippedCount++;
      continue;
    }

    try {
  const stats = await calculateTrackStats(t.points as any, tuningOverrides);
      const oldGain = t.elevationGain;
      const oldLoss = t.elevationLoss;
      const newGain = stats.elevationGain;
      const newLoss = stats.elevationLoss;
      const diffGain = typeof oldGain === 'number' ? newGain - oldGain : newGain;
      const diffLoss = typeof oldLoss === 'number' ? newLoss - oldLoss : newLoss;
      const diffGainPct = typeof oldGain === 'number' && oldGain > 0 ? (diffGain / oldGain) * 100 : undefined;
      const diffLossPct = typeof oldLoss === 'number' && oldLoss > 0 ? (diffLoss / oldLoss) * 100 : undefined;

      const shouldUpdate = updateStorage && (
        Math.abs(diffGain) >= minDiffMeters || Math.abs(diffLoss) >= minDiffMeters ||
        (diffGainPct !== undefined && Math.abs(diffGainPct) >= minDiffPercent) ||
        (diffLossPct !== undefined && Math.abs(diffLossPct) >= minDiffPercent)
      );

      if (shouldUpdate) {
        t.elevationGain = newGain;
        t.elevationLoss = newLoss;
        updatedCount++;
      }

      rows.push({
        id: t.id,
        name: t.name,
        points: t.points.length,
        oldGain,
        oldLoss,
        newGain,
        newLoss,
        diffGain,
        diffLoss,
        diffGainPct,
        diffLossPct,
        updated: shouldUpdate
      });

      // Small delay to avoid hammering elevation API
      if (i < target.length - 1) {
        await new Promise(r => setTimeout(r, batchDelayMs));
      }
    } catch (err) {
      console.warn(label, 'Errore nel ricalcolo:', err);
      rows.push({
        id: t.id,
        name: t.name,
        points: t.points.length,
        newGain: 0,
        newLoss: 0,
        diffGain: 0,
        diffLoss: 0,
        updated: false,
        skippedReason: 'Errore calcolo'
      });
      skippedCount++;
    }
  }

  if (updatedCount > 0 && updateStorage) {
    try { saveTracks(tracks); emit('tracks:updated', undefined); } catch {}
  }

  const summary: ElevationAuditSummary = {
    total: tracks.length,
    processed: target.length,
    updated: updatedCount,
    skipped: skippedCount,
    rows
  };

  emit('tracks:elevation-audit', summary);
  console.table(rows.map(r => ({
    id: r.id,
    name: r.name,
    pts: r.points,
    oldGain: r.oldGain,
    newGain: r.newGain,
    oldLoss: r.oldLoss,
    newLoss: r.newLoss,
    diffGain: r.diffGain,
    diffLoss: r.diffLoss,
    upd: r.updated,
    reason: r.skippedReason
  })));
  console.log('[ElevationAudit] Summary', summary);
  return summary;
}

// Convenience global trigger (developer console): window.runElevationAudit()
declare global {
  interface Window {
    runElevationAudit?: (opts?: ElevationAuditOptions) => Promise<ElevationAuditSummary>;
    recalcTrack?: (idOrName: string) => Promise<SavedTrack | null>;
    compareElevationSources?: (opts?: { maxTracks?: number; tuningOverrides?: ElevationTuningOverrides }) => Promise<void>;
    verifyTrackElevation?: (nameOrId: string) => Promise<any>;
  }
}

if (typeof window !== 'undefined') {
  window.runElevationAudit = (opts?: ElevationAuditOptions) => auditTrackElevations(opts);
  // Recalculate and persist elevation for a single track by ID or name
  window.recalcTrack = async (idOrName: string): Promise<SavedTrack | null> => {
    const tracks = getTracks();
    const t = tracks.find(tr => tr.id === idOrName || tr.name?.toLowerCase() === idOrName?.toLowerCase());
    if (!t || !t.points || t.points.length < 2) {
      console.warn('[ElevationAudit] Track not found or insufficient points:', idOrName);
      return null;
    }
    const stats = await calculateTrackStats(t.points as any);
    updateTrackElevations(t.id, stats.elevationGain, stats.elevationLoss, stats.length);
    const updated = getTracks().find(tr => tr.id === t.id) || null;
    console.info('[ElevationAudit] Recalculated:', updated?.name, 'D+ ', stats.elevationGain, 'D- ', stats.elevationLoss, 'len km', stats.length);
    return updated;
  };
  // Compare API vs TerrainRGB for a subset of tracks without persisting
  window.compareElevationSources = async (opts?: { maxTracks?: number; tuningOverrides?: ElevationTuningOverrides }) => {
    const { maxTracks, tuningOverrides } = opts || {};
    const tracks = getTracks().filter(t => t.points && t.points.length >= 2);
    const sample = typeof maxTracks === 'number' ? tracks.slice(0, maxTracks) : tracks;
    const rows = [] as Array<{
      id: string; name: string; pts: number;
      apiGain: number; apiLoss: number; demGain: number; demLoss: number;
      dGain: number; dLoss: number;
    }>;
    for (let i = 0; i < sample.length; i++) {
      const t = sample[i];
      try {
        const api = await calculateTrackStats(t.points as any, tuningOverrides, 'api');
        const dem = await calculateTrackStats(t.points as any, tuningOverrides, 'terrainrgb');
        rows.push({
          id: t.id,
          name: t.name,
          pts: t.points!.length,
          apiGain: api.elevationGain,
          apiLoss: api.elevationLoss,
          demGain: dem.elevationGain,
          demLoss: dem.elevationLoss,
          dGain: dem.elevationGain - api.elevationGain,
          dLoss: dem.elevationLoss - api.elevationLoss
        });
        // small pacing to avoid flood
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.warn('[ElevationAudit] compareSources failed for', t.name, err);
      }
    }
    console.table(rows);
    const agg = rows.reduce((a, r) => ({
      count: a.count + 1,
      meanGainDelta: a.meanGainDelta + r.dGain,
      meanLossDelta: a.meanLossDelta + r.dLoss
    }), { count: 0, meanGainDelta: 0, meanLossDelta: 0 });
    if (agg.count > 0) {
      agg.meanGainDelta /= agg.count;
      agg.meanLossDelta /= agg.count;
    }
    console.log('[ElevationAudit] Compare summary:', agg);
  };
  // Detailed verification for a single track across methods & sources
  window.verifyTrackElevation = async (nameOrId: string) => {
    const tracks = getTracks();
    const t = tracks.find(tr => tr.id === nameOrId || tr.name?.toLowerCase() === nameOrId.toLowerCase());
    if (!t || !t.points || t.points.length < 2) {
      console.warn('[ElevationAudit] Track not found or insufficient points for verification:', nameOrId);
      return null;
    }
    console.group(`[ElevationAudit] Verifica dislivello: ${t.name}`);
    const combos: Array<{ method: 'hysteresis'|'simple'; source: ElevationSource }> = [
      { method: 'hysteresis', source: 'api' },
      { method: 'hysteresis', source: 'terrainrgb' },
      { method: 'simple', source: 'api' },
      { method: 'simple', source: 'terrainrgb' }
    ];
    const results: any[] = [];
    for (const c of combos) {
      try {
        const stats = await calculateTrackStats(t.points as any, { method: c.method }, c.source);
        results.push({
          track: t.name,
          points: t.points.length,
          method: c.method,
          source: c.source,
          lengthKm: stats.length,
          Dplus: stats.elevationGain,
          Dminus: stats.elevationLoss,
          minEle: stats.minElevation,
          maxEle: stats.maxElevation
        });
      } catch (err) {
        results.push({ track: t.name, method: c.method, source: c.source, error: String(err) });
      }
    }
    console.table(results);
    // Heuristic pick: choose the combo with largest Dminus if descent track, else largest Dplus
    const isDescent = (t.name || '').toLowerCase().includes('lego') || (t.name || '').toLowerCase().includes('down') || (t.name || '').toLowerCase().includes('sp');
    const preferred = [...results].sort((a,b)=> isDescent ? b.Dminus - a.Dminus : b.Dplus - a.Dplus)[0];
    console.log('[ElevationAudit] Selezione suggerita:', preferred);
    console.groupEnd();
    return { results, suggested: preferred };
  };
  console.info('[ElevationAudit] Comandi disponibili:');
  console.info('- window.runElevationAudit({ updateStorage: true })');
  console.info('- window.recalcTrack("<track id or name>")');
  console.info('- window.compareElevationSources({ maxTracks: 20 })');
  console.info('- window.verifyTrackElevation("Pilunas")');
  console.info('- window.diagnosePilunas() // ultra-sensitive test');
  // Ultra-sensitive diagnostic for Pilunas
  (window as any).diagnosePilunas = async () => {
    const tracks = getTracks();
    const t = tracks.find(tr => tr.name?.toLowerCase().includes('pilunas'));
    if (!t || !t.points || t.points.length < 2) {
      console.warn('Pilunas not found'); return;
    }
    console.group('[Diagnose] Pilunas raw elevation');
    console.log('Original points:', t.points.length);
    console.log('First point:', t.points[0], 'Last point:', t.points[t.points.length - 1]);
    
    // Test raw summation without any filters
    (window as any).elev_debug = true;
    const testRaw = await calculateTrackStats(t.points as any, { 
      method: 'simple', k: 0, floor: 0, cap: 999, win: 1,
      spikeShortMeters: 5, spikeShortJump: 200, spikeSlope: 20, spikeSlopeMinJump: 150
    }, 'terrainrgb');
    console.log('Raw sum (relaxed spike filters):', testRaw);
    
    // Test 2: light smoothing + minimal threshold
    const test2 = await calculateTrackStats(t.points as any, { 
      method: 'simple', k: 0.3, floor: 0.5, cap: 10, win: 3,
      spikeShortMeters: 10, spikeShortJump: 100, spikeSlope: 10, spikeSlopeMinJump: 80
    }, 'terrainrgb');
    console.log('Test 2 - balanced (k=0.3, floor=0.5, win=3, permissive spikes):', test2);
    
    (window as any).elev_debug = false;
    console.groupEnd();
    return { testRaw, test2 };
  };
}
