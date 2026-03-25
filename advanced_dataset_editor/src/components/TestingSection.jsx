import React, { useState, useEffect } from "react";
import datasetApi from "./api/datasetApi";
import { useNotification } from "./NotificationContext";

const TestingSection = ({ onBackToEditor }) => {
  const { showNotification } = useNotification();
  const [datasetId, setDatasetId] = useState("test-dataset-001");
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [apiHealth, setApiHealth] = useState(null);

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 border border-transparent text-black rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(245,197,24,0.2)] active:scale-95 disabled:opacity-30";
  const cardCls = "bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl hover:border-white/20 transition-all group";
  const inputCls = "bg-zinc-900 border border-white/10 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all w-full shadow-inner";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3 ml-1";

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const healthy = await datasetApi.healthCheck();
      setApiHealth(healthy ? "Connected" : "Disconnected");
    } catch (error) {
      setApiHealth("Error");
    }
  };

  const loadManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await datasetApi.getManifest(datasetId);
      setManifest(data);
    } catch (err) {
      setError(`Failed to load manifest: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setUploadProgress("");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress("Starting upload...");

    try {
      const fileType = uploadFile.type.startsWith("image/") ? "image" : "label";
      setUploadProgress("Uploading file through backend...");
      const result = await datasetApi.uploadFileDirect(
        uploadFile,
        datasetId,
        fileType,
        "train"
      );

      setUploadProgress(`Upload successful! File: ${result.fileName}`);
      setUploadFile(null);
      await loadManifest();
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
      setUploadProgress("");
    } finally {
      setLoading(false);
    }
  };

  const testAnnotationSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const testImageId = "test-image-001";
      const testLabel = "0 0.5 0.5 0.3 0.4\n1 0.2 0.3 0.1 0.15";

      await datasetApi.saveAnnotation(
        datasetId,
        testImageId,
        testLabel,
        "train"
      );
      showNotification("Annotation saved successfully!", "success");

      const retrieved = await datasetApi.getAnnotation(
        datasetId,
        testImageId,
        "train"
      );
      console.log("Retrieved annotation:", retrieved);
    } catch (err) {
      setError(`Annotation test failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-100 font-sans p-8 animate-in overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-12">
        {/* Header */}
        <header className="flex items-center justify-between bg-zinc-950/50 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 blur-[100px] -mr-32 -mt-32 rounded-full transition-all group-hover:bg-yellow-400/10" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300 shadow-lg shadow-yellow-400/5">
              <span className="text-3xl">🧪</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                API Diagnostics
              </h1>
              <p className="text-zinc-500 font-medium uppercase tracking-widest text-[10px]">
                Backend Communication & Integrity Testing
              </p>
            </div>
          </div>
          <div className="relative z-10">
            <button
              onClick={onBackToEditor}
              className={btn}
            >
              <span className="text-lg">←</span> Back to Editor
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Status Section */}
          <section className={cardCls}>
            <label className={labelCls}>API Connectivity</label>
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-2xl mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full animate-pulse ${apiHealth === "Connected" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"}`} />
                <span className="text-sm font-bold text-zinc-300">
                  {apiHealth || "Establishing..."}
                </span>
              </div>
              <button onClick={checkApiHealth} className={btn}>
                Refresh Health
              </button>
            </div>

            <label className={labelCls}>Direct Upload Protocol</label>
            <div className="space-y-4">
              <div className="relative group/upload">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.txt"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="p-6 bg-zinc-900 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover/upload:border-yellow-400/30 group-hover/upload:bg-yellow-400/5 transition-all duration-300">
                   <div className="text-zinc-500 group-hover/upload:text-yellow-300 transition-colors">📄</div>
                   <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Select Diagnostics Payload</span>
                </div>
              </div>
              
              {uploadFile && (
                <div className="p-4 bg-yellow-400/5 border border-yellow-400/10 rounded-xl text-[10px] font-mono text-yellow-400/80 animate-in slide-in-from-top-2">
                   {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                </div>
              )}
              
              <button
                onClick={handleUpload}
                disabled={!uploadFile || loading}
                className={`${btnPrimary} w-full justify-center py-3 bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20`}
              >
                {loading ? "Transmitting..." : "Initiate S3 Upload Task"}
              </button>
              {uploadProgress && (
                <p className="text-[10px] text-zinc-500 italic text-center animate-pulse">{uploadProgress}</p>
              )}
            </div>
          </section>

          {/* Config Section */}
          <section className={cardCls}>
            <label className={labelCls}>Storage Context</label>
            <div className="space-y-6">
              <div>
                <input
                  type="text"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className={inputCls}
                  placeholder="Target Dataset UID"
                />
                <p className="mt-2 text-[10px] text-zinc-600 ml-1 italic">Scoped environment for testing operations.</p>
              </div>

              <div className="h-px bg-white/5" />

              <div>
                <label className={labelCls}>Validation Procedures</label>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={testAnnotationSave}
                    disabled={loading}
                    className={`${btn} justify-center py-3 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/5`}
                  >
                    Run Annotation Persistence Test
                  </button>
                  <button 
                    onClick={loadManifest} 
                    disabled={loading} 
                    className={`${btn} justify-center py-3 border-yellow-400/20 text-yellow-300 hover:bg-yellow-400/5`}
                  >
                    Fetch Remote Manifest
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Manifest View */}
        {manifest && (
          <section className={`${cardCls} animate-in fade-in slide-in-from-bottom-4`}>
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Remote Manifest Descriptor</h3>
               <div className="px-3 py-1 bg-zinc-900 border border-white/10 rounded-full text-[10px] font-mono text-zinc-500">
                 {manifest.files.length} units total
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {Object.entries(manifest.statistics).map(([key, value]) => (
                <div key={key} className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl group-hover:bg-zinc-800/50 transition-colors">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mb-1 tracking-widest">{key.replace(/_/g, " ")}</p>
                  <p className="text-lg font-black text-white leading-none">{value}</p>
                </div>
              ))}
            </div>

            <label className={labelCls}>File Index (Truncated View)</label>
            <div className="bg-zinc-950 border border-white/5 rounded-[24px] overflow-hidden">
               <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-zinc-900/50">
                       <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Identity</th>
                       <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Classification</th>
                       <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Dimension</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {manifest.files.slice(0, 10).map((file, idx) => (
                     <tr key={idx} className="hover:bg-yellow-400/5 transition-colors">
                       <td className="px-6 py-4 text-xs font-bold text-zinc-200">{file.fileName}</td>
                       <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-[9px] font-black uppercase tracking-tighter text-zinc-500">
                             {file.fileType} | {file.split}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-[10px] font-mono text-zinc-500">{(file.size / 1024).toFixed(2)} KB</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
            {manifest.files.length > 10 && (
              <p className="text-center mt-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                ... and {manifest.files.length - 10} more resource descriptors
              </p>
            )}
          </section>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom-2">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
               <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">Protocol Error</h4>
               <p className="text-sm text-red-400/80 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <section className="p-8 bg-zinc-950/80 border border-white/5 rounded-[32px] shadow-2xl">
          <h4 className="text-xs font-bold text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="text-yellow-300">📋</span> 
            Operational Guidelines
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
             {[
               "Verify backend API lifecycle state (check terminal outputs)",
               "Audit AWS IAM credential scoping in appsettings.json",
               "Validate target Dataset UID exists in remote storage",
               "Execute cross-origin boundary checks for file streams",
               "Monitor telemetry and persistence logs for cache invalidation"
             ].map((instr, i) => (
               <div key={instr} className="flex gap-4 group/item">
                  <span className="text-[10px] font-black text-yellow-400/40 group-hover/item:text-yellow-300 transition-colors">0{i+1}</span>
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed">{instr}</p>
               </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TestingSection;
